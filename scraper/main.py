import time
from datetime import datetime, timedelta
from StockScrapper import run_scraper

def run_python_script():
    """Executes the scraper and handles exceptions."""
    print(f"Running Python script at: {datetime.now().strftime('%Y-%m-%d %I:%M:%S %p')}")
    try:
        run_scraper()
    except Exception as e:
        print(f"Error executing Python script: {e}")


def schedule_python_script():
    """Schedules the scraper to run automatically Monday to Friday,

    from 9:30 AM to 3:30 PM, every 10 minutes.
    """
    print("Scheduler started. Running automatically Monday to Friday, 9:30 AM to 3:30 PM, every 10 minutes.")

    while True:
        now = datetime.now()

        # Check day of week (Monday = 0, Friday = 4)
        is_weekday = 0 <= now.weekday() <= 4

        # Check hour (9 to 15 inclusive)
        is_scheduled_hour = 9 <= now.hour <= 15

        # Check minute (0, 10, 20, 30, 40, 50)
        is_scheduled_minute = (now.minute % 10 == 0)

        if is_weekday and is_scheduled_hour and is_scheduled_minute:
            # Check precise sub-window: 9:30 AM to 3:30 PM
            start_time = now.replace(hour=9, minute=30, second=0, microsecond=0)
            end_time = now.replace(hour=15, minute=30, second=0, microsecond=0)

            if start_time <= now <= end_time:
                run_python_script()

        # Calculate sleep time to the next 10-minute boundary (e.g. 10:00, 10:10, etc.)
        now_after = datetime.now()
        minutes_to_add = 10 - (now_after.minute % 10)
        next_run = now_after + timedelta(minutes=minutes_to_add)
        next_run = next_run.replace(second=0, microsecond=0)

        sleep_seconds = (next_run - now_after).total_seconds()

        # Prevent double execution if we are exactly on the boundary
        if sleep_seconds < 5:
            sleep_seconds += 600
            next_run += timedelta(minutes=10)

        print(f"Next schedule check at: {next_run.strftime('%Y-%m-%d %I:%M:%S %p')}. Sleeping for {sleep_seconds:.1f} seconds...")
        time.sleep(sleep_seconds)


if __name__ == "__main__":
    schedule_python_script()
