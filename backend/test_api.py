import httpx
import json

def test_history():
    url = "http://localhost:8000/stock/RELIANCE/history"
    resp = httpx.get(url)
    print("Status Code:", resp.status_code)
    if resp.status_code == 200:
        data = resp.json()
        print(f"Received {len(data)} history data points.")
        if len(data) > 0:
            print("First point:", data[0])
            print("Last point:", data[-1])
    else:
        print("Response:", resp.text)

if __name__ == "__main__":
    test_history()
