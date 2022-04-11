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
