import pandas as pd
import plotly.express as px
from plotly.subplots import make_subplots

from typing import List
from .get_data import clean_format


color_mapper = {
    "air_temp": "#c42217",
    "sol_rad": "#c15366",
    "rh": "#a16a5c",
    "wind_spd": "#ec6607",
    "soil_temp": None,
    "soil_vwc": None,
    "ppt": None,
}

axis_mapper = {
    "ppt": "Daily<br>Precipitation<br>(in)",
    "soil_vwc": "Soil VWC.<br>(%)",
    "air_temp": "Air Temp.<br>(°F)",
    "rh": "Relative Hum.<br>(%)",
    "sol_rad": "Solar Rad.<br>(W/m<sup>2</sup>)",
    "wind_spd": "Wind Spd.<br>(mph)",
    "soil_temp": "Soil Temp.<br>(°F)",
}


def style_figure(fig):
    fig.update_layout({"plot_bgcolor": "rgba(0, 0, 0, 0)", "showlegend": False})
    fig.update_xaxes(showgrid=True, gridcolor="grey")
    fig.update_yaxes(showgrid=True, gridcolor="grey")
    fig.update_layout(showlegend=False)

    return fig


def plot_soil(dat, color):

    fig = px.line(
        dat,
        x="datetime",
        y="value",
        color="elem_lab",
        # color_discrete_sequence=['yellow', 'blue', 'pink', 'skyblbue'],
        # TODO: Refine hover data: https://plotly.com/python/hover-text-and-formatting/
        hover_name="elem_lab",
        hover_data=["value"],
    )
    fig.update_traces(connectgaps=False)

    return fig


def plot_met(dat, color):
    fig = px.line(dat, x="datetime", y="value", markers=True)

    fig = fig.update_traces(line_color=color, connectgaps=False)
    return fig


def plot_ppt(dat, color):
    fig = px.bar(dat, x="index", y="value")

    return fig


# credit to: https://stackoverflow.com/questions/7490660/converting-wind-direction-in-angles-to-text-words
def deg_to_compass(num):
    val = int((num / 22.5) + 0.5)
    arr = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ]
    return arr[(val % 16)]


def plot_wind(wind_data):
    wind_data = wind_data[["datetime", "value", "elem_lab"]]
    wind_data = (
        wind_data.pivot_table(values="value", columns="elem_lab", index="datetime")
        .reset_index()[["Wind Direction", "Wind Speed"]]
        .reset_index(drop=True)
    )

    # wind_data = pd.read_csv('~/misc/mco/wind_example.csv')
    wind_data["Wind Direction"] = wind_data["Wind Direction"].apply(deg_to_compass)
    wind_data["Wind Speed"] = round(wind_data["Wind Speed"])
    wind_data["Wind Speed"] = pd.qcut(wind_data["Wind Speed"], q=10, duplicates="drop")
    out = (
        wind_data.groupby(["Wind Direction", "Wind Speed"])
        .size()
        .reset_index(name="Frequency")
    )
    out["Wind Direction"] = pd.Categorical(
        out["Wind Direction"],
        [
            "N",
            "NNE",
            "NE",
            "ENE",
            "E",
            "ESE",
            "SE",
            "SSE",
            "S",
            "SSW",
            "SW",
            "WSW",
            "W",
            "WNW",
            "NW",
            "NNW",
        ],
    )
    out = out.sort_values(["Wind Direction", "Wind Speed"])
    out = out.rename(columns={"Wind Speed": "Wind Speed (mi/h)"})

    fig = px.bar_polar(
        out,
        r="Frequency",
        theta="Wind Direction",
        color="Wind Speed (mi/h)",
        template="plotly_white",
        color_discrete_sequence=px.colors.sequential.Plasma_r,
    )
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

    # return sub
    return style_figure(sub)


def filter_df(df, v):

    if "soil" in v or "air_temp" in v or "wind" in v:
        return df[df["element"].str.contains(v)]
    elif v == "rh" or v == "sol_rad":
        return df[df["element"] == v]
    return df


def get_plot_func(v):
    if "soil" in v:
        return plot_soil
    elif v == "ppt":
        return plot_ppt
    return plot_met


def plot_site(*args: List, hourly: pd.DataFrame, ppt: pd.DataFrame):

    # TODO: Add NaN values into missing data?
    plots = []

    for v in args:
        df = ppt if v == "ppt" else hourly
        plot_func = get_plot_func(v)
        data = filter_df(df, v)
        plots.append(plot_func(data, color_mapper[v]))

    sub = px_to_subplot(*plots, shared_xaxes=True)
    for row in range(1, len(plots) + 1):
        sub.update_yaxes(title_text=axis_mapper[args[row - 1]], row=row, col=1)

    return sub


def plot_stations(sites):

    fig = px.scatter_mapbox(
        sites,
        lat="latitude",
        lon="longitude",
        hover_name="name",
        hover_data=["station"],
        zoom=4.5,
        height=300,
    )
    fig.update_layout(mapbox_style="stamen-terrain")
    fig.update_layout(margin={"r": 0, "t": 0, "l": 0, "b": 0})
    return fig
