"""
pipeline/fetch.py

Fetch papers from arXiv API.
"""

from datetime import date
from pathlib import Path
import argparse
import arxiv
import polars as pl
import yaml
from datetime import date, timedelta
from tqdm import tqdm

CONFIG_PATH     = "../config/settings.yml"
CHECKPOINT_DIR  = "../data/checkpoints/fetch"
ARXIV_DIR  = "../data/arxiv_data"

def load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

def get_weekly_slices(year: int, month: int):
    """
    Splits the month into 7-day chunks regardless of the day of the week.
    Example: 1st-7th, 8th-14th, etc.
    """
    slices = []
    # Start on the 1st of the month
    curr = date(year, month, 1)
    
    while curr.month == month:
        # Define the start of the chunk
        start_str = curr.strftime("%Y%m%d0000")
        
        # Move forward 6 days to create a 7-day window
        end_dt = curr + timedelta(days=6)
        
        # If the 7-day window goes into the next month, clamp it to the month's end
        if end_dt.month != month:
            # Get last day of month: first day of next month minus one day
            if month == 12:
                next_month = date(year + 1, 1, 1)
            else:
                next_month = date(year, month + 1, 1)
            end_dt = next_month - timedelta(days=1)
            
        end_str = end_dt.strftime("%Y%m%d2359")
        slices.append((start_str, end_str))
        
        # Move to the day after the current end_dt
        curr = end_dt + timedelta(days=1)
        
    return slices


def fetch_month(year: int, month: int, categories: list):
    all_rows = []
    seen = set()
    client = arxiv.Client(page_size=500, delay_seconds=3.5)
    
    # Get total weeks for the main progress bar
    weeks = list(get_weekly_slices(year, month))
    
    # Outer Bar: Weeks
    pbar_weeks = tqdm(weeks, desc=f"Weeks in {year}-{month:02d}")
    for start_str, end_str in pbar_weeks:
        
        # Inner Bar: Categories (leave=False hides it after each week finishes)
        pbar_cats = tqdm(categories, desc="Categories", leave=False)
        for cat in pbar_cats:
            # Update the inner bar label to show the current category
            pbar_cats.set_postfix(cat=cat)
            
            query = f"cat:{cat} AND submittedDate:[{start_str} TO {end_str}]"
            search = arxiv.Search(query=query, sort_by=arxiv.SortCriterion.SubmittedDate)
            
            try:
                # client.results() is a generator; tqdm will show count but no ETA 
                # because it doesn't know the total number of papers ahead of time.
                for result in client.results(search):
                    arxiv_id = result.entry_id.split("/")[-1].split("v")[0]
                    if arxiv_id not in seen:
                        seen.add(arxiv_id)
                        all_rows.append({
                            "arxiv_id": arxiv_id,
                            "YYYY-MM": f"{year}-{month:02d}",
                            "title": result.title.strip(),
                            "abstract": result.summary.strip(),
                        })
            except Exception as exc:
                # Use tqdm.write instead of print/logger to avoid breaking the bar
                pbar_weeks.write(f"Warning: Failed {cat} for {start_str}: {exc}")
                continue 

    df = pl.DataFrame(all_rows)
    df.write_parquet(f'{ARXIV_DIR}/{date(year, month, 1).strftime("%Y%m")}.parquet')
    return

if __name__ == "__main__":

    config     = load_config()
    categories = config["arxiv"]["categories"]

    parser = argparse.ArgumentParser(description="Fetch data for a specific month.")
    
    # Define the arguments
    parser.add_argument("year", type=int, help="The year (e.g., 2023)")
    parser.add_argument("month", type=int, help="The month as a number (1-12)")

    # Parse and pass to your function
    args = parser.parse_args()
    fetch_month(args.year, args.month, categories)