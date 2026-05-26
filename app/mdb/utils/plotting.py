"""
Plotting Utilities for Montana Mesonet Dashboard

This module provides comprehensive plotting functions for visualizing meteorological
data, station maps, and time series analysis. It handles different data types
including precipitation, temperature, soil measurements, and wind data.

Key Functions:
- plot_site(): Main function for creating multi-panel station plots
- plot_station(): Interactive map of all stations
- plot_wind(): Wind rose diagrams
- plot_ppt(): Precipitation bar charts with normals
- plot_soil(): Multi-depth soil parameter visualizations
- plot_met(): General meteorological time series
- style_figure(): Consistent plot styling and formatting

The module supports various plot types, normal overlays, sensor change annotations,
and responsive design for the web dashboard.
"""

import ast
import os
from pathlib import Path
from typing import List, Optional

import geojson
import numpy as np
import pandas as pd
import plotly.colors as pc
import plotly.express as px
import plotly.graph_objects as go
from dateutil.relativedelta import relativedelta as rd
from plotly.subplots import make_subplots

from mdb.utils.params import params

on_server = os.getenv("ON_SERVER")


def style_figure(
    fig: go.Figure, x_ticks: Optional[List] = None, legend: bool = False
) -> go.Figure:
    """
    Apply consistent styling to plotly figures.

    Standardizes the appearance of plots throughout the dashboard with
    transparent backgrounds, grid lines, and optional legend display.

    Args:
        fig (go.Figure): Plotly figure object to style.
        x_ticks (Optional[List]): X-axis range limits [start, end]. If provided,
            applies to all x-axes in the figure.
        legend (bool): Whether to show the legend. Defaults to False.

    Returns:
        go.Figure: Styled figure with consistent formatting applied.

    Note:
        - Sets transparent plot background for web integration
        - Adds grey grid lines for better readability
        - Applies x-axis ranges to all subplots when specified
    """
    fig.update_layout({"plot_bgcolor": "rgba(0, 0, 0, 0)"})
    fig.update_xaxes(showgrid=True, gridcolor="grey")
    fig.update_yaxes(showgrid=True, gridcolor="grey")
    fig.update_layout(showlegend=legend)

    # finish implementing this: https://stackoverflow.com/questions/63213050/plotly-how-to-set-xticks-for-all-subplots
    if x_ticks:
        for ax in fig["layout"]:
            if ax[:5] == "xaxis":
                fig["layout"][ax]["range"] = x_ticks

    return fig


def merge_normal_data(v: str, df: pd.DataFrame, station: str) -> Optional[pd.DataFrame]:
    """
    Merge climatological normal data with station observations.

    Retrieves and merges gridMET climate normals (1991-2020) with station
    data to provide historical context for current conditions. Handles
    different variable types and temporal aggregations.

    Args:
        v (str): Variable name to get normals for (e.g., "Air Temperature [°F]").
        df (pd.DataFrame): Station data with datetime column.
        station (str): Station identifier for normal data lookup.

    Returns:
        Optional[pd.DataFrame]: DataFrame with added normal columns (mn, mx, avg)
            if normals are available, None if no normals exist for the variable.

    Note:
        - Normals are only shown at daily resolution (hour == 0)
        - Temperature and humidity use separate min/max normal files
        - Other variables use single normal files with quantiles
        - Normal data is fetched from GitHub repository
    """
    v_short = params.short_name_mapper.get(v, None)
    if v_short:
        if on_server is None or not on_server:
            norm = [
                pd.read_csv(
                    f"https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/normals/{station}_{x}.csv"
                )
                for x in v_short
            ]
        else:
            norm = [
                pd.read_csv(
                    f"https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/normals/{station}_{x}.csv"
                )
                for x in v_short
            ]

        norm_l = len(norm)
        norm = pd.concat(norm, axis=0)
        norm = norm[norm["type"] == "daily"]
        if norm_l == 2:
            filt_25, filt_75 = ["tmmn", "rmin"], ["tmmx", "rmax"]
            norm["mn"] = np.where(norm.variable.isin(filt_25), norm.q25, np.nan)
            norm["mx"] = np.where(norm.variable.isin(filt_75), norm.q75, np.nan)
            mn = norm[["month", "day", "mn"]].dropna()
            mx = norm[["month", "day", "mx"]].dropna()

            norm = mn.merge(mx, how="left", on=["month", "day"])
            norm = norm.assign(avg=(norm.mn + norm.mx) / 2)
        else:
            norm = norm.select_columns("month", "day", "q25", "q75", "median")
            norm.columns = ["month", "day", "mn", "mx", "avg"]

        df = df.assign(month=df.datetime.dt.month)
        df = df.assign(day=df.datetime.dt.day)
        df = df.merge(norm, on=["month", "day"])
        df = df.assign(
            mn=np.where(
                (df.datetime.dt.hour != 0)
                & (df.datetime != df.datetime.min())
                & (df.datetime != df.datetime.max()),
                np.nan,
                df.mn,
            )
        )
        df = df.assign(
            mx=np.where(
                (df.datetime.dt.hour != 0)
                & (df.datetime != df.datetime.min())
                & (df.datetime != df.datetime.max()),
                np.nan,
                df.mx,
            )
        )
        df = df.assign(
            avg=np.where(
                (df.datetime.dt.hour != 0)
                & (df.datetime != df.datetime.min())
                & (df.datetime != df.datetime.max()),
                np.nan,
                df.avg,
            )
        )
        return df

    return None


def _coerce_config_timestamp(value) -> Optional[pd.Timestamp]:
    if value is None:
        return None
    if isinstance(value, str) and value.strip().lower() in {"none", "nan", ""}:
        return None

    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return None
    if ts.tzinfo is None:
        return ts.tz_localize("America/Denver")
    return ts.tz_convert("America/Denver")


def _normalize_outage_ranges(value) -> List[List[str]]:
    if value is None:
        return []
    if isinstance(value, str):
        val = value.strip()
        if val.lower() in {"none", "nan", ""}:
            return []
        try:
            value = ast.literal_eval(val)
        except (ValueError, SyntaxError):
            return []

    if not isinstance(value, list):
        return []

    out = []
    for item in value:
        if isinstance(item, list):
            cleaned = [str(x) for x in item if x is not None and str(x).strip() != ""]
            if len(cleaned) > 0:
                out.append(cleaned)
    return out


def _current_config_timestamp(current_time=None) -> pd.Timestamp:
    current = _coerce_config_timestamp(current_time)
    if current is not None:
        return current
    return pd.Timestamp.now(tz="America/Denver")


def _event_timestamp(value: Optional[pd.Timestamp]) -> Optional[pd.Timestamp]:
    if value is None:
        return None
    return value + rd(hours=12)


def _interval_overlaps(
    start: pd.Timestamp,
    end: pd.Timestamp,
    range_start: pd.Timestamp,
    range_end: pd.Timestamp,
) -> bool:
    return start <= range_end and end >= range_start


def _row_active_at(row: dict, ts: pd.Timestamp) -> bool:
    active_start = row["active_start"]
    active_end = row["active_end"]
    return (active_start is None or active_start <= ts) and (
        active_end is None or active_end >= ts
    )


def _active_sensor_count(
    config_rows: List[dict], element: str, ts: pd.Timestamp
) -> int:
    count = sum(
        1
        for row in config_rows
        if row["element"] == element and _row_active_at(row, ts)
    )
    if count > 0:
        return count
    return sum(1 for row in config_rows if row["element"] == element)


def _merge_outage_segments(segments: List[dict]) -> List[dict]:
    if not segments:
        return []

    segments = sorted(segments, key=lambda x: (x["element"], x["x0"], x["x1"]))
    merged = [segments[0].copy()]
    for segment in segments[1:]:
        prev = merged[-1]
        if segment["element"] == prev["element"] and segment["x0"] <= prev["x1"]:
            prev["x1"] = max(prev["x1"], segment["x1"])
            prev["open_ended"] = prev["open_ended"] or segment["open_ended"]
        else:
            merged.append(segment.copy())
    return merged


def _build_sensor_events(
    config: pd.DataFrame,
    data_min: pd.Timestamp,
    default_width: pd.Timedelta,
    data_max: Optional[pd.Timestamp] = None,
    current_time: Optional[pd.Timestamp] = None,
) -> pd.DataFrame:
    if config is None or len(config) == 0:
        return pd.DataFrame()

    data_min = _coerce_config_timestamp(data_min)
    data_max = _coerce_config_timestamp(data_max)
    current_time = _current_config_timestamp(current_time)
    if data_min is None:
        return pd.DataFrame()
    if data_max is None:
        data_max = current_time

    events = []
    config_rows = []
    outage_records = []

    for sensor_id, (_, row) in enumerate(config.iterrows()):
        elem = str(row.get("elements", "Unknown Element"))

        start = _coerce_config_timestamp(row.get("date_start"))
        start_event = _event_timestamp(start)
        if start_event is not None and _interval_overlaps(
            start_event, start_event + default_width, data_min, data_max
        ):
            events.append(
                {
                    "reason": "added",
                    "x0": start_event,
                    "x1": start_event + default_width,
                    "element": elem,
                    "masks_data": False,
                    "open_ended": False,
                }
            )

        end = _coerce_config_timestamp(row.get("date_end"))
        end_event = _event_timestamp(end)
        if end_event is not None and _interval_overlaps(
            end_event, end_event + default_width, data_min, data_max
        ):
            events.append(
                {
                    "reason": "removed",
                    "x0": end_event,
                    "x1": end_event + default_width,
                    "element": elem,
                    "masks_data": False,
                    "open_ended": False,
                }
            )

        config_rows.append(
            {
                "sensor_id": sensor_id,
                "element": elem,
                "active_start": start_event,
                "active_end": end_event,
            }
        )

        for outage in _normalize_outage_ranges(row.get("outage_ranges")):
            outage_start = _coerce_config_timestamp(outage[0] if len(outage) > 0 else None)
            outage_end = _coerce_config_timestamp(outage[1] if len(outage) > 1 else None)
            if outage_start is None:
                continue

            outage_start_event = _event_timestamp(outage_start)
            outage_end_event = (
                _event_timestamp(outage_end) if outage_end is not None else current_time
            )
            if outage_end_event <= outage_start_event:
                outage_end_event = outage_start_event + default_width

            outage_records.append(
                {
                    "sensor_id": sensor_id,
                    "element": elem,
                    "x0": outage_start_event,
                    "x1": outage_end_event,
                    "open_ended": outage_end is None,
                }
            )

    if outage_records:
        outage_df = pd.DataFrame(outage_records)
        full_segments = []
        partial_segments = []

        for elem, elem_outages in outage_df.groupby("element"):
            boundaries = sorted(
                set(elem_outages["x0"].tolist() + elem_outages["x1"].tolist())
            )
            for start, end in zip(boundaries, boundaries[1:]):
                if end <= start:
                    continue

                midpoint = start + ((end - start) / 2)
                active_count = _active_sensor_count(config_rows, elem, midpoint)
                outage_slice = elem_outages[
                    (elem_outages["x0"] <= midpoint)
                    & (elem_outages["x1"] > midpoint)
                ]
                outage_count = outage_slice["sensor_id"].nunique()

                if active_count <= 0 or outage_count <= 0:
                    continue

                segment = {
                    "element": elem,
                    "x0": start,
                    "x1": end,
                    "open_ended": bool(outage_slice["open_ended"].any()),
                }
                if outage_count >= active_count:
                    full_segments.append(segment)
                else:
                    partial_segments.append(segment)

        for segment in _merge_outage_segments(full_segments):
            if _interval_overlaps(segment["x0"], segment["x1"], data_min, data_max):
                events.append(
                    {
                        "reason": "outage",
                        "x0": segment["x0"],
                        "x1": segment["x1"],
                        "element": segment["element"],
                        "masks_data": True,
                        "open_ended": segment["open_ended"],
                    }
                )

        for segment in _merge_outage_segments(partial_segments):
            event_end = segment["x0"] + default_width
            if _interval_overlaps(segment["x0"], event_end, data_min, data_max):
                events.append(
                    {
                        "reason": "partial_outage",
                        "x0": segment["x0"],
                        "x1": event_end,
                        "element": segment["element"],
                        "masks_data": False,
                        "open_ended": segment["open_ended"],
                    }
                )

    if len(events) == 0:
        return pd.DataFrame()

    events = pd.DataFrame(events)
    events = (
        events.groupby(
            ["reason", "x0", "x1", "masks_data", "open_ended"], dropna=False
        )["element"]
        .agg(lambda x: sorted(set(x)))
        .reset_index()
    )
    too_short = events["x1"] <= events["x0"]
    events.loc[too_short, "x1"] = events.loc[too_short, "x0"] + default_width
    return events


def _add_sensor_event_overlays(
    fig: go.Figure, events: pd.DataFrame, y_min: float, y_max: float
) -> go.Figure:
    if events is None or len(events) == 0:
        return fig

    if pd.isna(y_min) or pd.isna(y_max):
        y_min, y_max = 0, 1
    if y_min == y_max:
        y_min -= 1
        y_max += 1

    for _, event in events.iterrows():
        x0 = pd.to_datetime(event["x0"])
        x1 = pd.to_datetime(event["x1"])
        date0 = x0.strftime("%Y-%m-%d")
        date1 = x1.strftime("%Y-%m-%d")
        elems = ",<br>".join(event["element"])

        if event["reason"] == "added":
            text = (
                f"A sensor was added/replaced on {date0}, affecting the following "
                f"elements:<br>{elems}"
            )
        elif event["reason"] == "removed":
            text = (
                f"A sensor was sunset/removed on {date0}, affecting the following "
                f"elements:<br>{elems}"
            )
        elif event["reason"] == "partial_outage":
            if bool(event.get("open_ended", False)):
                text = (
                    f"An ongoing sensor outage was reported on {date0}, but another "
                    f"sensor for the same element remained available:<br>{elems}"
                )
            else:
                text = (
                    f"A sensor outage was reported on {date0}, but another sensor "
                    f"for the same element remained available:<br>{elems}"
                )
        elif event["reason"] == "outage_end":
            text = (
                f"A sensor outage ended on {date0}, affecting the following "
                f"elements:<br>{elems}"
            )
        else:
            if bool(event.get("open_ended", False)):
                text = (
                    f"A sensor outage was reported on {date0} and is ongoing as of "
                    f"{date1}, affecting the following elements:<br>{elems}"
                )
            elif date0 == date1:
                text = (
                    f"A sensor outage was reported on {date0}, affecting the following "
                    f"elements:<br>{elems}"
                )
            else:
                text = (
                    f"A sensor outage was reported on {date0} and lasted through {date1}, "
                    f"affecting the following elements:<br>{elems}"
                )

        fig.add_vrect(
            x0=x0,
            x1=x1,
            fillcolor="rgba(200,200,200,1)",
            opacity=0.75,
            line_width=0,
            layer="below",
        )
        fig.add_trace(
            go.Scatter(
                x=[x0, x0, x1, x1, x0],
                y=[y_min, y_max, y_max, y_min, y_min],
                fill="toself",
                mode="lines",
                line=dict(color="rgba(200,200,200,0.5)", width=0),
                showlegend=False,
                name="",
                text=text,
                opacity=0.5,
            )
        )

    return fig


def _coerce_datetime_series(values) -> pd.Series:
    datetimes = pd.to_datetime(values)
    if datetimes.dt.tz is None:
        return datetimes.dt.tz_localize("America/Denver")
    return datetimes.dt.tz_convert("America/Denver")


def _event_elements(event) -> set:
    elements = event["element"]
    if isinstance(elements, (list, tuple, set)):
        return set(elements)
    return {elements}


def _mask_data_for_outages(
    dat: pd.DataFrame, events: pd.DataFrame, value_columns: Optional[List[str]] = None
) -> pd.DataFrame:
    if events is None or len(events) == 0 or "masks_data" not in events.columns:
        return dat

    outage_events = events[events["masks_data"]]
    if len(outage_events) == 0:
        return dat

    out = dat.copy()
    datetimes = _coerce_datetime_series(out["datetime"])
    value_columns = value_columns or [x for x in out.columns if x != "datetime"]

    for _, event in outage_events.iterrows():
        elements = _event_elements(event)
        cols = [x for x in value_columns if x in elements]
        if not cols:
            continue

        x0 = pd.to_datetime(event["x0"])
        x1 = pd.to_datetime(event["x1"])
        mask = (datetimes >= x0) & (datetimes <= x1)
        for col in set(cols):
            out.loc[mask, col] = np.nan

    return out


def _value_bounds(dat: pd.DataFrame, columns) -> tuple:
    columns = [columns] if isinstance(columns, str) else list(columns)
    columns = [x for x in columns if x in dat.columns]
    if not columns:
        return np.nan, np.nan

    values = dat.loc[:, columns]
    if isinstance(values, pd.Series):
        values = values.to_frame()
    values = pd.to_numeric(pd.Series(values.to_numpy().ravel()), errors="coerce")
    return values.min(), values.max()


def plot_soil(dat, config, **kwargs):
    cols = dat.columns[1:].tolist()
    unit = {"Soil VWC": "%", "Soil Temperature": "°F", "Bulk EC": "mS/cm"}

    unit = unit[kwargs["txt"]]
    valid_config_elems = [x for x in config["elements"] if x in cols]
    config = config.copy()[config["elements"].isin(valid_config_elems)]
    sensor_events = _build_sensor_events(
        config=config,
        data_min=pd.to_datetime(dat["datetime"].min()),
        data_max=pd.to_datetime(dat["datetime"].max()),
        default_width=pd.Timedelta(hours=6),
    )
    dat = _mask_data_for_outages(dat, sensor_events, cols)
    dat = pd.concat(
        [
            pd.DataFrame({"datetime": dat["datetime"], "elem_lab": x, "value": dat[x]})
            for x in cols
        ]
    )

    fig = px.line(
        dat,
        x="datetime",
        y="value",
        color="elem_lab",
        color_discrete_map={
            f"{kwargs['txt']} @ 2 in [{unit}]": "#636efa",
            f"{kwargs['txt']} @ 4 in [{unit}]": "#EF553B",
            f"{kwargs['txt']} @ 8 in [{unit}]": "#00cc96",
            f"{kwargs['txt']} @ 20 in [{unit}]": "#ab63fa",
            f"{kwargs['txt']} @ 28 in [{unit}]": "#FFA15A",
            f"{kwargs['txt']} @ 36 in [{unit}]": "#FFA15A",
            f"{kwargs['txt']} @ 40 in [{unit}]": "#301934",
        },
    )

    fig.update_traces(
        connectgaps=False,
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>" + kwargs["txt"] + "</b>: %{y}",
    )

    fig = _add_sensor_event_overlays(
        fig=fig,
        events=sensor_events,
        y_min=dat["value"].min(),
        y_max=dat["value"].max(),
    )

    fig.update_layout(hovermode="x unified")

    return fig


def plot_met(dat, config, **kwargs):
    elem_columns = [x for x in dat.columns if x not in ["datetime"]]
    valid_config_elems = [x for x in config["elements"] if x in elem_columns]
    config = config.copy()[config["elements"].isin(valid_config_elems)]
    date_min = pd.to_datetime(dat["datetime"].min())
    date_max = pd.to_datetime(dat["datetime"].max())
    if (date_max - date_min) <= pd.Timedelta(days=31):
        vrect_width = pd.Timedelta(hours=6)
    else:
        vrect_width = pd.Timedelta(hours=48)
    sensor_events = _build_sensor_events(
        config=config, data_min=date_min, data_max=date_max, default_width=vrect_width
    )
    dat = _mask_data_for_outages(dat, sensor_events, elem_columns)

    # TODO: Debug cherry ridge temperature sensor swap

    y_col = dat.columns.tolist()[-1]
    variable_text = y_col
    station_name = kwargs["station"]["station"].values[0]

    fig = px.line(dat, x="datetime", y=y_col, markers=False)

    fig = fig.update_traces(line_color=kwargs["color"], connectgaps=False)

    variable_text = variable_text.replace("<br>", " ")

    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>" + variable_text + "</b>: %{y}"
    )

    if kwargs.get("norm", None):
        dat = merge_normal_data(variable_text, dat, station_name)
        if dat is None:
            return fig
        tmp = dat[["datetime", "mn", "mx", "avg"]].dropna()
        tmp = tmp.sort_values("datetime")
        mx_line = go.Scatter(
            x=tmp.datetime,
            y=tmp.mx,
            mode="lines",
            line={"dash": "dash", "color": "black"},
            showlegend=False,
            name="Average Max.<br>" + variable_text,
        )

        mn_line = go.Scatter(
            x=tmp.datetime,
            y=tmp.mn,
            mode="lines",
            line={"dash": "dash", "color": "black"},
            showlegend=False,
            name="Average Min.<br>" + variable_text,
            fill="tonexty",
            fillcolor="rgba(107,107,107,0.4)",
        )

        fig.add_trace(mx_line)
        fig.add_trace(mn_line)

    y_min, y_max = _value_bounds(dat, y_col)
    fig = _add_sensor_event_overlays(
        fig=fig,
        events=sensor_events,
        y_min=y_min,
        y_max=y_max,
    )

    return fig


def add_boxplot_normals(fig, norms):
    norm_upper = go.Scatter(
        x=norms.datetime,
        y=norms.mx,
        mode="markers",
        showlegend=False,
        marker_symbol="triangle-down",
        marker_color="black",
        name="75th Percentile",
    )

    norm_mid = go.Scatter(
        x=norms.datetime,
        y=norms.avg,
        mode="markers",
        showlegend=False,
        marker_symbol="circle",
        marker_color="black",
        name="Median",
    )

    norm_lower = go.Scatter(
        x=norms.datetime,
        y=norms.mn,
        mode="markers",
        showlegend=False,
        marker_symbol="triangle-up",
        marker_color="black",
        name="25th Percentile",
    )

    fig.add_trace(norm_upper)
    fig.add_trace(norm_mid)
    fig.add_trace(norm_lower)

    fig.update_layout(
        legend=dict(
            x=0,
            y=1,
            traceorder="normal",
            font=dict(family="sans-serif", size=12, color="black"),
        )
    )

    return fig


def plot_ppt(dat, config, **kwargs):
    elem_columns = [x for x in dat.columns if x not in ["datetime"]]
    valid_config_elems = [x for x in config["elements"] if x in elem_columns]
    config = config.copy()[config["elements"].isin(valid_config_elems)]
    sensor_events = _build_sensor_events(
        config=config,
        data_min=pd.to_datetime(dat["datetime"].min()),
        data_max=pd.to_datetime(dat["datetime"].max()),
        default_width=pd.Timedelta(hours=6),
    )
    dat = _mask_data_for_outages(dat, sensor_events, elem_columns)

    station_name = kwargs["station"]["station"].values[0]
    variable_text = dat.columns.tolist()[-1]
    # dat = dat.assign(datetime=dat.datetime.dt.date)
    fig = px.bar(dat, x="datetime", y=variable_text)
    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Precipitation Total</b>: %{y}"
    )

    if kwargs.get("norm", None):
        dat["datetime"] = pd.to_datetime(dat.datetime)
        norms = merge_normal_data(variable_text, dat, station_name)
        fig = add_boxplot_normals(fig, norms)

    y_min, y_max = _value_bounds(dat, variable_text)
    fig = _add_sensor_event_overlays(
        fig=fig,
        events=sensor_events,
        y_min=y_min,
        y_max=y_max,
    )

    return fig


def deg_to_compass(num: float) -> str:
    """
    Convert wind direction from degrees to compass bearing.

    Converts numerical wind direction (0-360 degrees) to standard
    16-point compass notation (N, NNE, NE, etc.).

    Args:
        num (float): Wind direction in degrees (0-360).

    Returns:
        str: Compass bearing abbreviation (e.g., 'N', 'SW', 'ESE').

    Note:
        Credit to: https://stackoverflow.com/questions/7490660/converting-wind-direction-in-angles-to-text-words
        Uses 22.5-degree sectors for 16-point compass rose.
    """
    val = int((num / 22.5) + 0.5)
    arr = params.wind_directions
    return arr[(val % 16)]


def plot_wind(wind_data: pd.DataFrame) -> go.Figure:
    """
    Create a wind rose diagram from wind speed and direction data.

    Generates a polar bar chart showing the frequency distribution of wind
    conditions by direction and speed categories. Useful for visualizing
    prevailing wind patterns at a station.

    Args:
        wind_data (pd.DataFrame): DataFrame with columns:
            - "Wind Direction [deg]": Wind direction in degrees
            - "Wind Speed [mi/hr]": Wind speed in miles per hour

    Returns:
        go.Figure: Plotly polar bar chart (wind rose) showing:
            - Radial axis: Frequency of occurrence
            - Angular axis: Wind direction (16-point compass)
            - Color: Wind speed categories (8 quantile bins)

    Note:
        - Automatically fills in missing wind directions with zero frequency
        - Uses quantile binning to create 8 wind speed categories
        - Applies Plasma color scheme for speed differentiation
    """
    wind_data = wind_data.dropna()
    wind_data["Wind Direction [deg]"] = wind_data["Wind Direction [deg]"].apply(
        deg_to_compass
    )
    wind_data["Wind Speed [mi/hr]"] = round(wind_data["Wind Speed [mi/hr]"])
    wind_data["Wind Speed [mi/hr]"] = pd.qcut(
        wind_data["Wind Speed [mi/hr]"], q=8, duplicates="drop"
    )
    out = (
        wind_data.groupby(["Wind Direction [deg]", "Wind Speed [mi/hr]"])
        .size()
        .reset_index(name="Frequency")
    )

    unq_wind = set(out["Wind Direction [deg]"])
    missing_dirs = [x for x in params.wind_directions if x not in unq_wind]
    speeds = set(out["Wind Speed [mi/hr]"].values)
    rows = [
        {"Wind Direction [deg]": x, "Wind Speed [mi/hr]": y, "Frequency": 0}
        for x in missing_dirs
        for y in speeds
    ]
    rows = pd.DataFrame(rows)

    out = pd.concat([out, rows], ignore_index=True)
    out["Wind Direction [deg]"] = pd.Categorical(
        out["Wind Direction [deg]"], params.wind_directions, ordered=True
    )
    out = out.sort_values(["Wind Direction [deg]", "Wind Speed [mi/hr]"])
    # out["Wind Speed [mi/hr]"] = out["Wind Speed [mi/hr]"].astype(str)
    out = out.rename(columns={"Wind Direction [deg]": "Wind Direction"})

    fig = px.bar_polar(
        out,
        r="Frequency",
        theta="Wind Direction",
        color="Wind Speed [mi/hr]",
        template="plotly_white",
        color_discrete_sequence=px.colors.sequential.Plasma_r,
    )

    return fig


def plot_etr(dat: pd.DataFrame, station: pd.DataFrame, **kwargs):
    station_name = station["station"].values[0]

    fig = px.bar(dat, x="datetime", y="Reference ET (a=0.23) [in]")
    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Reference ET Total</b>: %{y}",
        marker_color="#FF0000",
    )

    if kwargs.get("norm", None):
        dat["datetime"] = pd.to_datetime(dat.datetime)
        norms = merge_normal_data("ET", dat, station_name)
        fig = add_boxplot_normals(fig, norms)

    return fig


def px_to_subplot(*figs, **kwargs):
    """
    Converts a list of plotly express figures (*figs) into a subplot with 1 column.

    Returns:
        A single plotly subplot.
    """
    fig_traces = []

    for fig in figs:
        fig_items = {}
        traces = []
        for trace in range(len(fig["data"])):
            traces.append(fig["data"][trace])
        try:
            shapes = fig["layout"]["shapes"]
        except IndexError:
            shapes = ""

        fig_items["shapes"] = shapes
        fig_items["traces"] = traces
        fig_traces.append(fig_items)

    sub = make_subplots(rows=len(figs), cols=1, **kwargs)
    for idx, items in enumerate(fig_traces, start=1):
        traces, shapes = items["traces"], items["shapes"]
        if len(traces) > 0:
            for trace in traces:
                sub.append_trace(trace, row=idx, col=1)
        else:
            sub.add_trace(*traces, row=idx, col=1)

        if shapes:
            for shape in shapes:
                sub.add_shape(shape, row=idx, col=1)

    return sub


def filter_df(df, v):
    var_cols = [x for x in df.columns if v in x]
    cols = ["datetime"] + var_cols
    df = df[cols]
    return df


def get_plot_func(v):
    if "Soil" in v or "Bulk" in v:
        return plot_soil
    elif v == "Precipitation":
        return plot_ppt
    return plot_met


def get_soil_legend_loc(dat):
    try:
        tmax = max(
            dat.iloc[:, dat.columns.str.contains("Soil Temperature")].max(axis=0)
        )
    except ValueError:
        tmax = None
    try:
        vmax = max(dat.iloc[:, dat.columns.str.contains("Soil VWC")].max(axis=0))
    except ValueError:
        vmax = None
    try:
        ecmax = max(dat.iloc[:, dat.columns.str.contains("Bulk EC")].max(axis=0))
    except ValueError:
        ecmax = None

    # We want dates to range ~35% of the x axiss
    dmax, dmin = dat.datetime.max(), dat.datetime.min()
    delta = ((dmax - dmin) * 0.35) / 5
    d = [dmax - (delta * i) for i in range(6)]

    return {"Soil Temperature": tmax, "Soil VWC": vmax, "Bulk EC": ecmax, "d": d}


def get_soil_depths(dat):
    cols = dat.columns[dat.columns.str.contains("VWC")].tolist()
    vals = dat[cols].sum()
    vals = vals[vals != 0].index.tolist()
    return [" ".join(x.split()[3:5]) for x in vals]


def add_soil_legend(sub, idx, xs, y, depths):
    if not idx:
        return sub

    labs = {
        "40 in": "#301934",
        "36 in": "#FFA15A",
        "28 in": "#FFA15A",
        "20 in": "#ab63fa",
        "8 in": "#00cc96",
        "4 in": "#EF553B",
        "2 in": "#636efa",
    }

    for idx2, d in enumerate(reversed(depths)):
        sub.add_annotation(
            x=xs[idx2],
            y=y,
            xref="x1",
            yref=idx[0],
            text=d,
            showarrow=False,
            font=dict(family="Courier New, monospace", size=12, color="#ffffff"),
            align="center",
            bordercolor="#c7c7c7",
            xanchor="right",
            yanchor="middle",
            bgcolor=labs[d],
            opacity=0.8,
        )
    return sub


def add_nodata_lab(sub, d, idx, v):
    txt = f"<b>{v} data are not available for this time period.</b>"

    yref = f"y{idx}"

    sub.add_annotation(
        dict(
            x=d,
            y=2,
            xref="x1",
            yref=yref,
            text=txt,
            showarrow=False,
            font=dict(color="black", size=18),
            align="center",
            bordercolor="#c7c7c7",
            xanchor="center",
            yanchor="middle",
            bgcolor="white",
            opacity=1,
        )
    )

    return sub


def plot_site(*args: List, dat: pd.DataFrame, config: pd.DataFrame, **kwargs):
    plots = {}
    no_data = {}
    no_data_df = dat[["datetime"]].drop_duplicates()
    no_data_df = no_data_df.assign(data=None)
    for idx, v in enumerate(args, 1):
        try:
            if v == "Reference ET":
                plt = plot_etr(dat=dat, **kwargs)
            else:
                plot_func = get_plot_func(v)
                data = filter_df(dat, v)

                if len(data) == 0 or data.shape[-1] == 1:
                    raise ValueError("No Data Available.")
                if v in ["Soil Temperature", "Soil VWC", "Bulk EC"]:
                    kwargs.update({"txt": v})

                plt = plot_func(
                    data, config=config, color=params.color_mapper[v], **kwargs
                )
        except (KeyError, ValueError):
            plt = px.line(no_data_df, x="datetime", y="data", markers=True)
            no_data[idx] = v

        plots[v] = plt

    sub = px_to_subplot(*list(plots.values()), shared_xaxes=False)
    for row in range(1, len(plots) + 1):
        ylab = list(plots.keys())[row - 1]
        title_text = params.axis_mapper[ylab]
        if ylab in ["Precipitation", "Reference ET"]:
            if kwargs["period"] == "daily":
                title_text = title_text.replace("(inches)", "(inches/day)")
            elif kwargs["period"] == "hourly":
                title_text = title_text.replace("(inches)", "(inches/hour)")
            elif kwargs["period"] == "raw":
                if ylab == "Precipitation":
                    title_text = title_text.replace("(inches)", "(inches)")
                if ylab == "Reference ET":
                    title_text = title_text.replace("(inches)", "(inches/hour)")

        # don't update label.
        sub.update_yaxes(title_text=title_text, row=row, col=1)

        # If this subplot represents snow depth, set y-axis minimum to 0 and ensure max is at least 1
        if "snow" in ylab.lower() and "depth" in ylab.lower():
            plt_orig = plots[ylab]
            y_max_vals = []
            for tr in getattr(plt_orig, "data", []):
                try:
                    ys = np.array(tr.y)
                    ys = ys[~np.isnan(ys)]
                    if ys.size > 0:
                        y_max_vals.append(ys.max())
                except Exception:
                    continue
            y_max = float(np.nanmax(y_max_vals)) if y_max_vals else 1.0
            if y_max < 1.0:
                y_max = 1.0
            sub.update_yaxes(range=[0, y_max], row=row, col=1)

    height = 500 if len(plots) == 1 else 250 * len(plots)
    sub.update_layout(height=height)
    x_ticks = [
        dat.datetime.min().date() - rd(days=1),
        dat.datetime.max().date() + rd(days=1),
    ]
    sub = style_figure(sub, x_ticks)
    sub.update_layout(margin={"r": 0, "t": 20, "l": 0, "b": 0})
    if "Soil Temperature" in no_data or "Soil VWC" in no_data or "Bulk EC" in no_data:
        return sub

    soil_info = get_soil_legend_loc(dat)

    for v in "Soil Temperature", "Soil VWC", "Bulk EC":
        if v in list(args):
            idx = [f"y{idx + 1}" for idx, x in enumerate(list(args)) if v in x]

            sub = add_soil_legend(
                sub=sub,
                idx=idx,
                xs=soil_info["d"],
                y=soil_info[v],
                depths=get_soil_depths(dat),
            )

    for idx, v in no_data.items():
        sub = add_nodata_lab(sub=sub, d=no_data_df.datetime.mean(), idx=idx, v=v)
    return sub


def plot_station(stations, station=None, zoom=4):
    stations = stations[["station", "long_name", "elevation", "latitude", "longitude"]]
    stations = stations.assign(
        url=stations["long_name"]
        + ": [View Latest Data](/dash/"
        + stations["station"]
        + "/)"
    )

    grouped = stations.groupby(["latitude", "longitude"])
    stations = grouped.agg(
        {
            "long_name": lambda x: ",<br>".join(x),
            "elevation": lambda x: round(np.unique(x)[0]),
            "url": lambda x: ", ".join(x),
            "station": lambda x: ",".join(np.unique(x)),
        }
    ).reset_index()

    stations["color"] = np.where(
        stations["long_name"].str.contains("AgriMet"), "#00cc96", "#7A7AFB"
    )
    stations["color"] = np.where(
        stations["long_name"].str.contains(",<br>"), "#FB7A7A", stations["color"]
    )
    if station:
        stations = stations.assign(
            color=np.where(
                stations["station"].str.contains(station), "#FFD700", stations["color"]
            )
        )

    stations = stations.sort_values(by=["color"])
    fig = go.Figure(
        go.Scattermapbox(
            mode="markers",
            lon=stations["longitude"],
            lat=stations["latitude"],
            marker={"size": 10, "color": stations["color"]},
            customdata=stations,
            hovertemplate="<b>Station(s)</b>: %{customdata[2]}<br><extra></extra>",
            # "<b>Latitude, Longitude</b>: %{lat}, %{lon}<br>" +
            # "<b>Elevation (m)</b>: %{customdata[3]}<br><extra></extra>",
            hoverinfo="none",
        )
    )

    county_pth = (
        str(Path(__file__).resolve().parents[3] / "mt_counties.geojson")
        if on_server is None or not on_server
        else "/app/mt_counties.geojson"
    )
    with open(county_pth) as f:
        counties = geojson.load(f)

    fig.update_layout(
        height=300,
        mapbox_style="white-bg",
        mapbox_layers=[
            # Hillshade
            {
                "below": "traces",
                "sourcetype": "raster",
                "sourceattribution": "USGS Map Tiles",
                "source": [
                    "https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}"
                ],
            },
            # State outlines and labels
            {
                "below": "traces",
                "name": "test",
                "sourcetype": "geojson",
                "sourceattribution": "",
                "type": "fill",
                "color": "rgba(0, 0, 0, 0)",
                "source": counties,
            },
        ],
        mapbox={"center": {"lon": -109.5, "lat": 47}, "zoom": zoom},
        margin={"r": 0, "t": 0, "l": 0, "b": 0},
        autosize=True,
        hoverlabel_align="right",
    )

    return fig


def plot_annual(dat: pd.DataFrame, colname: str):
    dat = dat.copy()
    dat["datetime"] = pd.to_datetime(dat["datetime"], utc=True)
    dat["julian"] = dat["datetime"].dt.dayofyear
    dat["Year"] = dat["datetime"].dt.year
    dat["date"] = dat["datetime"].dt.date

    # If colname is Precipitation [in], plot annual cumulative sum
    if colname == "Precipitation [in]":
        dat = dat.sort_values(["Year", "julian"])
        dat["cumsum"] = dat.groupby("Year")[colname].cumsum()
        y_col = "cumsum"
        y_label = "Annual Cumulative Precipitation [in]"
    else:
        y_col = colname
        y_label = colname

    fig = px.line(dat, x="julian", y=y_col, color="Year")
    # Get colors from OrRd palette
    years = dat["Year"].unique()
    n = len(years) - 1

    if n == 1:
        samps = [0.5]
    else:
        samps = [(1 / (n - 1) * i) * 0.60 + 0.15 for i in range(n)]

    colors = pc.sample_colorscale(px.colors.sequential.YlGnBu, samps)
    colors.append("black")  # Add light grey for current year

    for i, trace in enumerate(fig.data):
        if i == len(fig.data) - 1:
            trace.line.width = 3
        trace.line.color = colors[i]
        trace.showlegend = True

    fig.update_layout(
        legend=dict(
            yanchor="top",
            y=0.99,
            xanchor="left",
            x=1.01,
            bgcolor="rgba(255, 255, 255, 0.5)",
        )
    )

    fig.update_traces(connectgaps=False)
    fig.update_layout(xaxis_title="Day of Year", yaxis_title=y_label)
    return style_figure(fig, legend=True)


# Credit to https://plotly.com/python/images/#zoom-on-static-images
def plot_latest_ace_image(station, direction="N", dt=None):
    if dt:
        source = f"{params.API_URL}photos/{station}/{direction}/?force=True&dt={dt}"
    else:
        source = f"{params.API_URL}photos/{station}/{direction}/?force=True"

    # Create figure
    fig = go.Figure()

    # Constants
    img_width = 1920
    img_height = 1080
    scale_factor = 0.25

    # Add invisible scatter trace.
    # This trace is added to help the autoresize logic work.
    fig.add_trace(
        go.Scatter(
            x=[0, img_width * scale_factor],
            y=[0, img_height * scale_factor],
            mode="markers",
            marker_opacity=0,
        )
    )

    # Configure axes
    fig.update_xaxes(visible=False, range=[0, img_width * scale_factor])

    fig.update_yaxes(
        visible=False,
        range=[0, img_height * scale_factor],
        # the scaleanchor attribute ensures that the aspect ratio stays constant
        scaleanchor="x",
    )

    # Add image
    fig.add_layout_image(
        dict(
            x=0,
            sizex=img_width * scale_factor,
            y=img_height * scale_factor,
            sizey=img_height * scale_factor,
            xref="x",
            yref="y",
            opacity=1.0,
            layer="below",
            sizing="stretch",
            source=source,
        )
    )

    # Configure other layout
    fig.update_layout(
        width=img_width * scale_factor,
        height=img_height * scale_factor,
        margin={"l": 0, "r": 0, "t": 0, "b": 0},
    )

    return fig


def make_nodata_figure(txt: str = "No data available for selected dates.") -> go.Figure:
    """
    Create a placeholder figure for when no data is available.

    Generates a clean, empty plot with a centered message explaining
    why no data is displayed. Used throughout the dashboard when
    queries return empty results.

    Args:
        txt (str): Message to display in the figure. Defaults to
            "No data available for selected dates."

    Returns:
        go.Figure: Empty plotly figure with centered text annotation.

    Note:
        - Removes all axes and tick labels for clean appearance
        - Uses consistent styling with white background
        - Standard height of 500px for layout consistency
    """
    fig = go.Figure()
    fig.add_annotation(
        dict(
            font=dict(color="black", size=18),
            x=0.5,
            y=0.5,
            showarrow=False,
            text=txt,
            textangle=0,
            xanchor="center",
            xref="paper",
            yref="paper",
        )
    )
    fig.update_layout(
        yaxis_visible=False,
        yaxis_showticklabels=False,
        xaxis_visible=False,
        xaxis_showticklabels=False,
        paper_bgcolor="white",
        plot_bgcolor="white",
        height=500,
    )
    return fig


def make_single_plot(dat):
    x, y = dat.columns
    fig = px.line(dat, x=x, y=y, markers=False)
    fig = fig.update_traces(line_color="black", connectgaps=False)
    fig.update_layout(xaxis_title=None)
    return style_figure(fig)
