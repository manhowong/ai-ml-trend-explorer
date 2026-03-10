"""
pipeline/embed.py

Embed paper abstracts and L2 node descriptions, compute cosine similarities.
"""

import json
import numpy as np
import polars as pl
import yaml
from sentence_transformers import SentenceTransformer
from pathlib import Path

CONFIG_PATH    = "../config/settings.yml"
METADATA_PATH  = "../data/metadata.json"
ARXIV_DIR      = "../data/arxiv_data"
EMBED_DIR      = "../data/checkpoints/embeddings"

def load_config():
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)

def load_l2_nodes():
    with open(METADATA_PATH) as f:
        metadata = json.load(f)
    return {
        k: v for k, v in metadata["nodes"].items()
        if v["L"] == 2
    }

def embed_texts(model, texts: list[str], batch_size: int = 256) -> np.ndarray:
    return model.encode(texts, batch_size=64, show_progress_bar=True)

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = a / np.linalg.norm(a, axis=1, keepdims=True)
    b = b / np.linalg.norm(b, axis=1, keepdims=True)
    return a @ b.T

def assign_tiers(scores: np.ndarray, node_ids: list, threshold: float, t1_gap: float):
    ranked_idx = np.argsort(scores)[::-1]
    ranked_scores = scores[ranked_idx]
    ranked_nodes = [node_ids[i] for i in ranked_idx]

    candidates = [(n, s) for n, s in zip(ranked_nodes, ranked_scores) if s >= threshold]

    if not candidates:
        return [], [], [], [], [], []

    top_score = candidates[0][1]

    t1 = [(n, s) for n, s in candidates if top_score - s < t1_gap][:2]
    rest = candidates[len(t1):]
    t2 = rest[:3]
    t3 = rest[3:6]

    return (
        [n for n, _ in t1], [round(s, 4) for _, s in t1],
        [n for n, _ in t2], [round(s, 4) for _, s in t2],
        [n for n, _ in t3], [round(s, 4) for _, s in t3],
    )

def run(year: int, month: int):
    config     = load_config()
    threshold  = config["classification"]["confidence_threshold"]
    t1_gap     = config["classification"]["t1_gap"]
    model_name = config["embedding"]["model"]
    batch_size = config["embedding"]["batch_size"]

    # Load papers
    ym = f"{year}{month:02d}"
    df = pl.read_parquet(f"{ARXIV_DIR}/{ym}.parquet")

    # Load L2 nodes
    nodes     = load_l2_nodes()
    node_ids  = list(nodes.keys())
    node_desc = [f"{v['N']}" for v in nodes.values()]

    # Embed
    model = SentenceTransformer(model_name)
    node_emb = embed_texts(model, node_desc, batch_size)
    abstract_emb = embed_texts(model, df["abstract"].to_list(), batch_size)

    # Save embeddings
    Path(EMBED_DIR).mkdir(parents=True, exist_ok=True)
    np.save(f"{EMBED_DIR}/{ym}_abstracts.npy", abstract_emb)
    np.save(f"{EMBED_DIR}/nodes.npy", node_emb)

    # Compute similarities
    sim_matrix = cosine_similarity(abstract_emb, node_emb)  # (n_papers, n_nodes)

    # Assign tiers
    results = []
    ambiguous = []

    for i, row in enumerate(df.iter_rows(named=True)):
        scores = sim_matrix[i]
        t1, t1s, t2, t2s, t3, t3s = assign_tiers(scores, node_ids, threshold, t1_gap)

        record = {
            "arxiv_id":   row["arxiv_id"],
            "YYYY-MM":    row["YYYY-MM"],
            "T1":         t1,  "T1_cos_sim": t1s,
            "T2":         t2,  "T2_cos_sim": t2s,
            "T3":         t3,  "T3_cos_sim": t3s,
            "TU":         [],
            "K":          [],
            "method":     "emb",
        }

        if not t1:
            ambiguous.append({**record, "top_candidates": [
                {"node": node_ids[j], "score": round(float(scores[j]), 4)}
                for j in np.argsort(scores)[::-1][:config["classification"]["top_n_candidates"]]
            ]})
        else:
            results.append(record)

    # Save
    out_dir = Path(f"../data/checkpoints/classified")
    out_dir.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(results).write_parquet(f"{out_dir}/{ym}_classified.parquet")
    pl.DataFrame(ambiguous).write_parquet(f"{out_dir}/{ym}_ambiguous.parquet")

    print(f"Classified: {len(results)} | Ambiguous: {len(ambiguous)}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("year", type=int)
    parser.add_argument("month", type=int)
    args = parser.parse_args()
    run(args.year, args.month)