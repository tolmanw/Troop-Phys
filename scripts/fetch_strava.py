import os
import json
import requests
from datetime import datetime, timedelta, timezone

# --- Load environment variables ---
CLIENT_ID = os.environ['STRAVA_CLIENT_ID']
CLIENT_SECRET = os.environ['STRAVA_CLIENT_SECRET']
REFRESH_TOKENS_JSON = os.environ['STRAVA_REFRESH_TOKENS']

# Parse refresh tokens
refresh_tokens = json.loads(REFRESH_TOKENS_JSON)

# --- Helper functions ---
def refresh_access_token(refresh_token):
    """Exchange refresh token for access token."""
    response = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
    )
    data = response.json()
    if "access_token" not in data:
        print("Error refreshing token:", data)
        return None
    return data["access_token"]

def get_month_start_dates():
    """Return timestamps for first day of previous, current, and next month."""
    now = datetime.now(timezone.utc)
    first_current = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    # Previous month
    prev_month = first_current - timedelta(days=1)
    first_previous = datetime(prev_month.year, prev_month.month, 1, tzinfo=timezone.utc)

    # Next month
    if now.month == 12:
        first_next = datetime(now.year+1, 1, 1, tzinfo=timezone.utc)
    else:
        first_next = datetime(now.year, now.month+1, 1, tzinfo=timezone.utc)

    return int(first_previous.timestamp()), int(first_current.timestamp()), int(first_next.timestamp()), [first_previous, first_current, first_next]

def fetch_activities(access_token, after_ts):
    """Fetch activities since after_ts."""
    url = "https://www.strava.com/api/v3/athlete/activities"
    params = {"after": after_ts, "per_page": 200}
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        print("Error fetching activities:", response.text)
        return []
    activities = response.json()
    return activities if isinstance(activities, list) else []

# --- Main process ---
athletes_out = {}

prev_ts, curr_ts, next_ts, month_starts = get_month_start_dates()
month_names = [m.strftime("%B %Y") for m in month_starts]

for username, info in refresh_tokens.items():
    print(f"Fetching data for {username}...")
    access_token = refresh_access_token(info["refresh_token"])
    if not access_token:
        continue

    # Get all activities since previous month start
    activities = fetch_activities(access_token, prev_ts)
    print(f"Total activities fetched: {len(activities)}")

    # Filter activities to desired types
    valid_types = ['Run', 'Trail Run', 'Walk', 'Hike', 'Ride', 'Virtual Ride']
    activities_filtered = [a for a in activities if a.get("type") in valid_types]
    print(f"Filtered activities: {len(activities_filtered)}")

    # Prepare daily distance arrays for current month
    now = datetime.now(timezone.utc)
    days_in_month = (datetime(now.year, now.month+1, 1, tzinfo=timezone.utc) - datetime(now.year, now.month, 1, tzinfo=timezone.utc)).days if now.month < 12 else 31
    daily_distance = [0.0]*days_in_month
    daily_time = ["0:00"]*days_in_month

    # Prepare monthly totals
    monthly_distance = [0.0, 0.0, 0.0]  # previous, current, next
    monthly_time = ["0:00", "0:00", "0:00"]

    for act in activities_filtered:
        dt = datetime.strptime(act["start_date_local"], "%Y-%m-%dT%H:%M:%S%z")
        dist_km = act.get("distance", 0)/1000
        time_sec = act.get("moving_time", 0)
        h = int(time_sec // 3600)
        m = int((time_sec % 3600) // 60)
        time_str = f"{h}:{m:02d}"

        # Assign distances and time to months
        if dt.year == month_starts[0].year and dt.month == month_starts[0].month:
            monthly_distance[0] += dist_km
            h_prev, m_prev = map(int, monthly_time[0].split(":"))
            total_mins = h_prev*60 + m_prev + h*60 + m
            monthly_time[0] = f"{total_mins//60}:{total_mins%60:02d}"
        elif dt.year == month_starts[1].year and dt.month == month_starts[1].month:
            monthly_distance[1] += dist_km
            h_prev, m_prev = map(int, monthly_time[1].split(":"))
            total_mins = h_prev*60 + m_prev + h*60 + m
            monthly_time[1] = f"{total_mins//60}:{total_mins%60:02d}"
            daily_distance[dt.day-1] += dist_km
            daily_time[dt.day-1] = f"{h}:{m:02d}"
        elif dt.year == month_starts[2].year and dt.month == month_starts[2].month:
            monthly_distance[2] += dist_km
            h_prev, m_prev = map(int, monthly_time[2].split(":"))
            total_mins = h_prev*60 + m_prev + h*60 + m
            monthly_time[2] = f"{total_mins//60}:{total_mins%60:02d}"

    # Fetch athlete profile
    athlete_url = "https://www.strava.com/api/v3/athlete"
    headers = {"Authorization": f"Bearer {access_token}"}
    profile_data = requests.get(athlete_url, headers=headers).json()
    profile_img = profile_data.get("profile", "")

    athletes_out[username] = {
        "firstname": profile_data.get("firstname", ""),
        "lastname": profile_data.get("lastname", ""),
        "username": username,
        "profile": profile_img,
        "monthly_distances": [round(d,2) for d in monthly_distance],
        "monthly_time": monthly_time,
        "daily_distance_km": [round(d,2) for d in daily_distance],
        "daily_time": daily_time
    }

# --- Write JSON ---
os.makedirs("data", exist_ok=True)
with open("data/athletes.json", "w") as f:
    json.dump({"athletes": athletes_out, "month_names": month_names}, f, indent=2)

print("athletes.json updated successfully.")
