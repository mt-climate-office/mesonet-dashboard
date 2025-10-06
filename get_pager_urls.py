#!/usr/bin/env python3
import httpx
import json
import os


def get_airtable_attachments(base_id, table_name, api_key):
    url = f"https://api.airtable.com/v0/{base_id}/{table_name}"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {
        "filterByFormula": "NOT({One-pager}='')",
        "fields[]": ["Station", "One-pager"],
    }
    results = []
    offset = None
    with httpx.Client() as client:
        n = 0
        while True:
            print(n)
            n += 1
            if offset:
                params["offset"] = offset
            response = client.get(url, headers=headers, params=params)
            data = response.json()
            for record in data.get("records", []):
                station = record["fields"].get("Station")[0]
                attachment_url = record["fields"].get("One-pager", [{}])[0].get("url")
                results.append({"station": station, "url": attachment_url})
            offset = data.get("offset")
            if not offset:
                break
    return results


if __name__ == "__main__":
    attachments = get_airtable_attachments(
        "app824YSpANyRDcto", "tblromhLqOpbnliMh", os.environ["AIRTABLE_API_KEY"]
    )

    with open("one-pagers.json", "w") as f:
        json.dump(attachments, f, indent=2)

    print(f"Wrote {len(attachments)} attachments to one-pagers.json")
