import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from dateutil.relativedelta import relativedelta as rd

from .et_calc import fao_etr_hourly as et_h, fao_etr_daily as et_d
from .params import params
from typing import List


def style_figure(fig, x_ticks):
    fig.update_layout(
        {"plot_bgcolor": "rgba(0, 0, 0, 0)"},
        # legend=dict(
        #     yanchor="top",
        #     y=0.99,
        #     xanchor="left",
        #     x=0.01
        # )
    )
    fig.update_xaxes(showgrid=True, gridcolor="grey")
    fig.update_yaxes(showgrid=True, gridcolor="grey")
    fig.update_layout(showlegend=False)

    # finish implementing this: https://stackoverflow.com/questions/63213050/plotly-how-to-set-xticks-for-all-subplots
    for ax in fig["layout"]:
        if ax[:5] == "xaxis":
            fig["layout"][ax]["range"] = x_ticks

    return fig


def plot_soil(dat, **kwargs):

    cols = dat.columns[1:].tolist()
    dat = pd.concat(
        [
            pd.DataFrame({"datetime": dat["datetime"], "elem_lab": x, "value": dat[x]})
            for x in cols
        ]
    )
    # TODO: Finish pivot for soil data
    # TODO: Make wind data work.
    # something like this: [pd.DataFrame({'datetime': asdf, "elem_lab": asdf, "value": asdf}) for x in cols]

    fig = px.line(
        dat,
        x="datetime",
        y="value",
        color="elem_lab",
    )
    fig.update_traces(
        connectgaps=False,
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Soil Moisture</b>: %{y}",
    )

    fig.update_layout(
        hovermode="x unified",
    )

    return fig


def plot_met(dat, **kwargs):
    variable_text = dat.columns.tolist()[-1]
    fig = px.line(dat, x="datetime", y=variable_text, markers=True)

    fig = fig.update_traces(line_color=kwargs["color"], connectgaps=False)

    variable_text = variable_text.replace("<br>", " ")

    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>" + variable_text + "</b>: %{y}",
    )
    return fig


def plot_ppt(dat, **kwargs):
    variable_text = dat.columns.tolist()[-1]
    dat = dat.assign(datetime=dat.datetime.dt.date)
    fig = px.bar(dat, x="datetime", y=variable_text)
    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Precipitation Total</b>: %{y}",
    )
    return fig


# credit to: https://stackoverflow.com/questions/7490660/converting-wind-direction-in-angles-to-text-words
def deg_to_compass(num):
    val = int((num / 22.5) + 0.5)
    arr = params.wind_directions
    return arr[(val % 16)]


def plot_wind(wind_data):

    # wind_data = wind_data[["datetime", "value", "elem_lab"]]
    # wind_data = (
    #     wind_data.pivot_table(values="value", columns="elem_lab", index="datetime")
    #     .reset_index()[["Wind Direction", "Wind Speed"]]
    #     .reset_index(drop=True)
    # )

    # wind_data = pd.read_csv('~/misc/mco/wind_example.csv').rename(columns={'wind_spd': 'Wind Speed', 'wind_dir': 'Wind Direction'})
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


# def plot_etr(hourly):
    
#     dat = hourly[['datetime', 'Air Temperature [°F]', 'Atmospheric Pressure [mbar]', 'Relative Humidity [%]', 'Solar Radiation [W/m²]', 'Wind Speed [mi/hr]']]
    
#     dat.index = pd.DatetimeIndex(dat.index)
#     dat = pd.DataFrame(dat.groupby(dat.index.date)["Precipitation [in]"].agg("sum"))
#     ppt.index = pd.DatetimeIndex(ppt.index)
#     ppt.index = ppt.index.tz_localize("America/Denver")
#     out = pd.concat([dat, ppt], axis=1)
#     na_cou

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

    # return sub
    return sub


def filter_df(df, v):

    var_cols = [x for x in df.columns if v in x]
    cols = ["datetime"] + var_cols

    df = df[cols]

    if len(df) == 0:
        return df

    return df


def get_plot_func(v):
    if "Soil" in v:
        return plot_soil
    elif v == "Precipitation":
        return plot_ppt
    return plot_met


def plot_site(*args: List, hourly: pd.DataFrame, ppt: pd.DataFrame):

    # station = np.unique(hourly["station"])[0]

    plots = []

    for v in args:
        df = ppt if v == "Precipitation" else hourly
        plot_func = get_plot_func(v)
        data = filter_df(df, v)
        if len(data) == 0:
            continue
        plots.append(plot_func(data, color=params.color_mapper[v]))

    sub = px_to_subplot(*plots, shared_xaxes=False)
    for row in range(1, len(plots) + 1):
        sub.update_yaxes(title_text=params.axis_mapper[args[row - 1]], row=row, col=1)

    height = 500 if len(plots) == 1 else 250 * len(plots)
    sub.update_layout(height=height)
    x_ticks = [hourly.datetime.min().date(), hourly.datetime.max().date() + rd(days=1)]
    sub = style_figure(sub, x_ticks)
    sub.update_layout(
        margin={"r": 0, "t": 20, "l": 0, "b": 0},
    )
    return sub


def plot_station(stations):
    stations = stations[["station", "long_name", "elevation", "latitude", "longitude"]]
    stations = stations.assign(
        url=stations["long_name"]
        + ": [View Latest Data](https://fcfc-mesonet-staging.cfc.umt.edu/dash/"
        + stations["station"]
        + ")"
    )

    grouped = stations.groupby(["latitude", "longitude"])
    stations = grouped.agg(
        {
            "long_name": lambda x: ",<br>".join(x),
            "elevation": lambda x: round(np.unique(x)[0]),
            "url": lambda x: ", ".join(x),
        }
    ).reset_index()

    stations["color"] = np.where(
        stations["long_name"].str.contains(",<br>"), "#FB7A7A", "#7A7AFB"
    )

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
                "sourceattribution": "MapTiler API Hillshades",
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
        mapbox={
            "center": {
                "lon": -109.5,
                "lat": 47,
            },
            "zoom": 4,
        },
        margin={"r": 0, "t": 0, "l": 0, "b": 0},
        autosize=True,
        hoverlabel_align="right",
    )

    return fig


# Credit to https://plotly.com/python/images/#zoom-on-static-images
def plot_latest_ace_image(station, direction="N"):

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
            source=f"https://mesonet.climate.umt.edu/api/v2/photos/{station}/{direction}/?force=True",
        )
    )

    # Configure other layout
    fig.update_layout(
        margin={"l": 0, "r": 0, "t": 0, "b": 0},
    )

    return fig
