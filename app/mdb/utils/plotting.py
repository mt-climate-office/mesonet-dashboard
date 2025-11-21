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


def plot_soil(dat, config, **kwargs):
    cols = dat.columns[1:].tolist()
    dat = pd.concat(
        [
            pd.DataFrame({"datetime": dat["datetime"], "elem_lab": x, "value": dat[x]})
            for x in cols
        ]
    )
    unit = {"Soil VWC": "%", "Soil Temperature": "°F", "Bulk EC": "mS/cm"}

    unit = unit[kwargs["txt"]]
    valid_config_elems = [
        x for x in config["elements"] if x in dat["elem_lab"].drop_duplicates().tolist()
    ]
    config = config.copy()[config["elements"].isin(valid_config_elems)]
    sensor_additions = config[
        pd.to_datetime(config["date_start"]).dt.tz_localize("America/Denver")
        >= pd.to_datetime(dat["datetime"].min())
    ]
    sensor_additions = (
        sensor_additions.groupby("date_start")
        .agg(
            {
                "elements": lambda x: ",<br>".join(x),
            }
        )
        .reset_index()
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
    for _, row in sensor_additions.iterrows():
        first = pd.to_datetime(row["date_start"]) + rd(hours=12)
        second = first + rd(hours=6)
        fig.add_vrect(
            x0=first,
            x1=second,
            fillcolor="rgba(200,200,200,1)",
            opacity=0.75,
            line_width=0,
            layer="below",
            annotation_text=None,
        )
        # Add transparent trace for hovertext
        # Add transparent trace for hovertext
        fig.add_trace(
            go.Scatter(
                x=[first, first, second, second, first],
                y=[
                    dat["value"].min(),
                    dat["value"].max(),
                    dat["value"].max(),
                    dat["value"].min(),
                    dat["value"].min(),
                ],
                fill="toself",
                mode="lines",
                line=dict(color="rgba(200,200,200,0.5)", width=0),
                showlegend=False,
                name="",  # Add this line to remove "trace 1" from the legend
                text=f"A sensor was added/replaced on {pd.to_datetime(row['date_start']).strftime('%Y-%m-%d')}, affecting the following elements:<br>{row['elements']}",
                opacity=0.5,
            )
        )
        # Move the last trace (the transparent marker) to the frontmost layer
        fig.data = fig.data[:-1] + (fig.data[-1],)

    fig.update_layout(hovermode="x unified")

    return fig


def plot_met(dat, config, **kwargs):
    elem_columns = [x for x in dat.columns if x not in ["datetime"]]
    valid_config_elems = [x for x in config["elements"] if x in elem_columns]
    config = config.copy()[config["elements"].isin(valid_config_elems)]
    sensor_additions = config[
        pd.to_datetime(config["date_start"]).dt.tz_localize("America/Denver")
        >= pd.to_datetime(dat["datetime"].min())
    ]
    sensor_additions = (
        sensor_additions.groupby("date_start")
        .agg(
            {
                "elements": lambda x: ",\n".join(x),
            }
        )
        .reset_index()
    )

    # TODO: Debug cherry ridge temperature sensor swap

    variable_text = dat.columns.tolist()[-1]
    station_name = kwargs["station"]["station"].values[0]

    fig = px.line(dat, x="datetime", y=variable_text, markers=False)

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

    for _, row in sensor_additions.iterrows():
        # Determine width based on date range
        date_min = pd.to_datetime(dat["datetime"].min())
        date_max = pd.to_datetime(dat["datetime"].max())
        if (date_max - date_min) <= pd.Timedelta(days=31):
            vrect_width = pd.Timedelta(hours=6)
        else:
            vrect_width = pd.Timedelta(hours=48)
        first = pd.to_datetime(row["date_start"]) + rd(hours=12)
        second = first + vrect_width

        fig.add_vrect(
            x0=first,
            x1=second,
            fillcolor="rgba(200,200,200,1)",
            opacity=0.75,
            line_width=0,
            layer="below",
        )
        # Add transparent trace for hovertext
        fig.add_trace(
            go.Scatter(
                x=[first, first, second, second, first],
                y=[
                    dat[variable_text].min(),
                    dat[variable_text].max(),
                    dat[variable_text].max(),
                    dat[variable_text].min(),
                    dat[variable_text].min(),
                ],
                fill="toself",
                mode="lines",
                line=dict(color="rgba(200,200,200,0.5)", width=0),
                showlegend=False,
                name="",
                text=f"A sensor was added/replaced on {pd.to_datetime(row['date_start']).strftime('%Y-%m-%d')}, affecting the following elements:<br>{row['elements']}",
                opacity=0.5,
            )
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
    sensor_additions = config[
        pd.to_datetime(config["date_start"]).dt.tz_localize("America/Denver")
        >= pd.to_datetime(dat["datetime"].min())
    ]
    sensor_additions = (
        sensor_additions.groupby("date_start")
        .agg(
            {
                "elements": lambda x: ",\n".join(x),
            }
        )
        .reset_index()
    )

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

    for _, row in sensor_additions.iterrows():
        first = pd.to_datetime(row["date_start"]) + rd(hours=12)
        second = first + rd(hours=6)

        fig.add_vrect(
            x0=first,
            x1=second,
            fillcolor="rgba(200,200,200,1)",
            opacity=0.75,
            line_width=0,
            layer="below",
        )
        # Add transparent trace for hovertext
        fig.add_trace(
            go.Scatter(
                x=[first, first, second, second, first],
                y=[
                    dat[variable_text].min(),
                    dat[variable_text].max(),
                    dat[variable_text].max(),
                    dat[variable_text].min(),
                    dat[variable_text].min(),
                ],
                fill="toself",
                mode="lines",
                line=dict(color="rgba(200,200,200,0.5)", width=0),
                showlegend=False,
                name="",
                text=f"A sensor was added/replaced on {pd.to_datetime(row['date_start']).strftime('%Y-%m-%d')}, affecting the following elements:<br>{row['elements']}",
                opacity=0.5,
            )
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
        str(Path("~/git/mesonet-dashboard/mt_counties.geojson").expanduser())
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

    fig = px.line(dat, x="julian", y=colname, color="Year")
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
    fig.update_layout(xaxis_title="Day of Year", yaxis_title=colname)
    return style_figure(fig, legend=True)


# Credit to https://plotly.com/python/images/#zoom-on-static-images
def plot_latest_ace_image(station, direction="N", dt=None):
    if dt:
        source = f"https://mesonet.climate.umt.edu/api/v2/photos/{station}/{direction}/?force=True&dt={dt}"
    else:
        source = f"https://mesonet.climate.umt.edu/api/v2/photos/{station}/{direction}/?force=True"

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
