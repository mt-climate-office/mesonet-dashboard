"""
Table Generation Utilities for Montana Mesonet Dashboard

This module provides functions for creating formatted data tables
used throughout the dashboard interface. It handles metadata display,
data formatting, and table structure for Dash DataTable components.

Key Functions:
- make_metadata_table(): Format station metadata for display
"""

from typing import Any, Dict, List

import pandas as pd


def make_metadata_table(station_df: pd.DataFrame, station: str) -> List[Dict[str, Any]]:
    """
    Create a formatted metadata table for a specific station.

    Extracts and formats key station information into a two-column table
    suitable for display in the dashboard's metadata tab.

    Args:
        station_df (pd.DataFrame): DataFrame containing all station metadata.
        station (str): Station identifier to extract metadata for.

    Returns:
        List[Dict[str, Any]]: List of dictionaries with 'Field' and 'Value' keys
            representing station metadata in table format. Includes:
            - Station Name: Short identifier
            - Long Name: Full descriptive name
            - Date Installed: Installation date
            - Sub Network: Network affiliation (HydroMet/AgriMet)
            - Longitude/Latitude: Geographic coordinates
            - Elevation: Height above sea level in meters

    Note:
        - Transposes the data to create a vertical field-value layout
        - Uses human-readable field names for display
        - Returns empty list if station is not found
    """
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

    out["elevation"] = round(out["elevation"] * 3.281)

    out.columns = [
        "Station Name",
        "Long Name",
        "Date Installed",
        "Sub Network",
        "Longitude",
        "Latitude",
        "Elevation (ft)",
    ]

    out = out.T.reset_index()
    out.columns = ["Field", "Value"]
    return out.to_dict("records")
