import json
from pathlib import Path

import requests

HEADERS = {
    "User-Agent": "lofi-artist-intelligence-test/0.1"
}

url = "https://www.reddit.com/r/techno/hot.json?limit=10"

response = requests.get(url, headers=HEADERS, timeout=15)
print("Status:", response.status_code)
print("Content-Type:", response.headers.get("content-type"))

response.raise_for_status()

data = response.json()

posts = []
for child in data["data"]["children"]:
    post = child["data"]
    posts.append({
        "subreddit": post.get("subreddit"),
        "title": post.get("title"),
        "score": post.get("score"),
        "num_comments": post.get("num_comments"),
        "created_utc": post.get("created_utc"),
        "url": "https://reddit.com" + post.get("permalink", ""),
        "selftext": post.get("selftext", ""),
    })

Path("data/raw").mkdir(parents=True, exist_ok=True)

with open("data/raw/reddit_json_test_posts.json", "w", encoding="utf-8") as f:
    json.dump(posts, f, indent=2, ensure_ascii=False)

print(f"Saved {len(posts)} posts")
for post in posts[:3]:
    print("-", post["title"])
