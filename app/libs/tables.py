import pandas as pd
import numpy as np

def make_metadata_table(station_df, station):
    out = station_df[station_df["station"] == station][
        [
            "station",
            "name",
            "date_installed",
            "sub_network",
            "longitude",
            "latitude",
            "elevation",
        ]
    ]

    out.columns = [
        "Station Name",
        "Long Name",
        "Date Installed",
        "Sub Network",
        "Longitude",
        "Latitude",
        "Elevation (m)",
    ]

    out = out.T.reset_index()
    out.columns = ["Field", "Value"]
    return out.to_dict("records")


def make_latest_table(df):
    latest = df["datetime"].max()
    out = df[df["datetime"] == pd.Timestamp(latest)]

    latest = latest.tz_convert("America/Denver")
    latest_df = pd.DataFrame.from_dict(
        {"elem_lab": ["Latest Reading"], "value": [latest]}
    )
    out["units"] = np.where(out['units'] == "percent", "%", out["units"])
    out.loc[out.units == "percent", "units"] = "%"
    out["value"] = out["value"].astype(str) + " " + out["units"]
    out = out[["elem_lab", "value"]].reset_index(drop=True)
    out = pd.concat([latest_df, out])
    return out.to_dict("records")
