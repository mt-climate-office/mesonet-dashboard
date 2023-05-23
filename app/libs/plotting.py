from typing import List

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from dateutil.relativedelta import relativedelta as rd
from plotly.subplots import make_subplots

from .et_calc import fao_etr_daily as et_d
from .params import params


def style_figure(fig, x_ticks=None, legend=False):
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


def merge_normal_data(v, df, station):
    v_short = params.short_name_mapper.get(v, None)
    if v_short:
        norm = [pd.read_csv(f"/app/normals/{station}_{x}.csv") for x in v_short]
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


def plot_soil(dat, **kwargs):
    cols = dat.columns[1:].tolist()
    dat = pd.concat(
        [
            pd.DataFrame({"datetime": dat["datetime"], "elem_lab": x, "value": dat[x]})
            for x in cols
        ]
    )
    unit = {"Soil VWC": "%", "Soil Temperature": "°F", "Bulk EC": "mS/cm"}

    unit = unit[kwargs["txt"]]
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
            f"{kwargs['txt']} @ 36 in [{unit}]": "#FFA15A",
            f"{kwargs['txt']} @ 40 in [{unit}]": "#301934",
        },
    )

    fig.update_traces(
        connectgaps=False,
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>" + kwargs["txt"] + "</b>: %{y}",
    )

    fig.update_layout(hovermode="x unified")

    return fig


def plot_met(dat, **kwargs):
    variable_text = dat.columns.tolist()[-1]
    station_name = kwargs["station"]["station"].values[0]

    fig = px.line(dat, x="datetime", y=variable_text, markers=True)

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


def plot_ppt(dat, **kwargs):
    station_name = kwargs["station"]["station"].values[0]
    variable_text = dat.columns.tolist()[-1]
    dat = dat.assign(datetime=dat.datetime.dt.date)
    fig = px.bar(dat, x="datetime", y=variable_text)
    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Precipitation Total</b>: %{y}"
    )

    if kwargs.get("norm", None):
        dat["datetime"] = pd.to_datetime(dat.datetime)
        norms = merge_normal_data(variable_text, dat, station_name)
        fig = add_boxplot_normals(fig, norms)

    return fig


# credit to: https://stackoverflow.com/questions/7490660/converting-wind-direction-in-angles-to-text-words
def deg_to_compass(num):
    val = int((num / 22.5) + 0.5)
    arr = params.wind_directions
    return arr[(val % 16)]


def plot_wind(wind_data):
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


def plot_etr(hourly, station, **kwargs):
    station_name = station["station"].values[0]
    drop_thresh = 12 * 20 if station_name[:3] == "ace" else 4 * 20
    drop_thresh = 20 if kwargs["top_of_hour"] else drop_thresh

    hourly["Solar Radiation [W/m²]"] = hourly["Solar Radiation [W/m²]"].fillna(0)

    dat = hourly[
        [
            "datetime",
            "Air Temperature [°F]",
            "Atmospheric Pressure [mbar]",
            "Relative Humidity [%]",
            "Solar Radiation [W/m²]",
            "Wind Speed [mi/hr]",
        ]
    ]

    dat.index = pd.DatetimeIndex(dat.datetime)
    dat = dat.assign(date=dat.index.date)
    dat = dat.dropna()

    gaps = dat.groupby(dat.index.date).size()
    dat = dat.reset_index(drop=True)

    lat = station["latitude"]
    station["longitude"]
    elev = station["elevation"]

    calc_daily = (
        dat[dat.date.isin(gaps[gaps >= drop_thresh].index.values)]
        .assign(julian=dat.datetime.dt.dayofyear)
        .groupby_agg(
            by="date",
            agg="mean",
            agg_column_name="Air Temperature [°F]",
            new_column_name="Air Temperature [°F]",
        )
        .groupby_agg(
            by="date",
            agg="mean",
            agg_column_name="Atmospheric Pressure [mbar]",
            new_column_name="Atmospheric Pressure [mbar]",
        )
        .groupby_agg(
            by="date",
            agg="mean",
            agg_column_name="Relative Humidity [%]",
            new_column_name="Relative Humidity [%]",
        )
        .groupby_agg(
            by="date",
            agg="mean",
            agg_column_name="Solar Radiation [W/m²]",
            new_column_name="Solar Radiation [W/m²]",
        )
        .groupby_agg(
            by="date",
            agg="mean",
            agg_column_name="Wind Speed [mi/hr]",
            new_column_name="Wind Speed [mi/hr]",
        )
        .select_columns("datetime", invert=True)
        .drop_duplicates()
    )

    calc_daily["et_d"] = calc_daily.apply(
        lambda x: et_d(
            lat,
            x["julian"],
            elev,
            x["Relative Humidity [%]"],
            (x["Air Temperature [°F]"] - 32) * (5 / 9),
            x["Solar Radiation [W/m²]"],
            x["Atmospheric Pressure [mbar]"] / 10,
            x["Wind Speed [mi/hr]"] * 0.44704,
        )
        * (1 / 25.4),
        axis=1,
    )

    calc_daily = (
        calc_daily[["date", "et_d"]]
        .assign(et_d=round(calc_daily.et_d, 3))
        .drop_duplicates()
        .rename_column("date", "datetime")
        .rename_column("et_d", "Reference ET [in/day]")
    )

    fig = px.bar(calc_daily, x="datetime", y="Reference ET [in/day]")
    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Reference ET Total</b>: %{y}",
        marker_color="#FF0000",
    )

    if kwargs.get("norm", None):
        calc_daily["datetime"] = pd.to_datetime(calc_daily.datetime)
        norms = merge_normal_data("ET", calc_daily, station_name)
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
        traces = []
        for trace in range(len(fig["data"])):
            traces.append(fig["data"][trace])
        fig_traces.append(traces)

    sub = make_subplots(rows=len(figs), cols=1, **kwargs)
    for idx, traces in enumerate(fig_traces, start=1):
        if len(traces) > 0:
            for trace in traces:
                sub.append_trace(trace, row=idx, col=1)
        else:
            sub.add_trace(*traces, row=idx, col=1)

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
    d = dat.datetime.max()
    d = [d - rd(hours=24 * i) for i in range(6)]

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


def plot_site(*args: List, dat: pd.DataFrame, ppt: pd.DataFrame, **kwargs):
    plots = {}
    no_data = {}
    no_data_df = dat[["datetime"]].drop_duplicates()
    no_data_df = no_data_df.assign(data=None)
    for idx, v in enumerate(args, 1):
        try:
            if v == "Reference ET":
                plt = plot_etr(hourly=dat, **kwargs)
            else:
                df = ppt if v == "Precipitation" else dat
                plot_func = get_plot_func(v)
                data = filter_df(df, v)

                if len(data) == 0 or data.shape[-1] == 1:
                    raise ValueError("No Data Available.")
                if v in ["Soil Temperature", "Soil VWC", "Bulk EC"]:
                    kwargs.update({"txt": v})

                plt = plot_func(data, color=params.color_mapper[v], **kwargs)
        except (KeyError, ValueError):
            plt = px.line(no_data_df, x="datetime", y="data", markers=True)
            no_data[idx] = v

        plots[v] = plt

    sub = px_to_subplot(*list(plots.values()), shared_xaxes=False)
    for row in range(1, len(plots) + 1):
        sub.update_yaxes(
            title_text=params.axis_mapper[list(plots.keys())[row - 1]], row=row, col=1
        )

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
            idx = [f"y{idx+1}" for idx, x in enumerate(list(args)) if v in x]

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


def plot_station(stations, station=None):
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
        stations["long_name"].str.contains(",<br>"), "#FB7A7A", "#7A7AFB"
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
                "sourcetype": "raster",
                "sourceattribution": 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>; Map data; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                "source": [
                    "https://stamen-tiles.a.ssl.fastly.net/toner-hybrid/{z}/{x}/{y}.png"
                ],
            },
        ],
        mapbox={"center": {"lon": -109.5, "lat": 47}, "zoom": 4},
        margin={"r": 0, "t": 0, "l": 0, "b": 0},
        autosize=True,
        hoverlabel_align="right",
    )

    return fig


# Credit to https://plotly.com/python/images/#zoom-on-static-images
def plot_latest_ace_image(station, direction="N", dt=None):
    # Create figure
    fig = go.Figure()

    # Constants
    img_width = 2048
    img_height = 1446
    scale_factor = 0.22

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
    if dt:
        source = f"https://mesonet.climate.umt.edu/api/v2/photos/{station}/{direction}/?force=True&dt={dt}"
    else:
        source = f"https://mesonet.climate.umt.edu/api/v2/photos/{station}/{direction}/?force=True"
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
    fig.update_layout(margin={"l": 0, "r": 0, "t": 0, "b": 0})

    return fig


def make_nodata_figure(txt="No data avaliable for selected dates."):
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
