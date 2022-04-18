import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from dateutil.relativedelta import relativedelta as rd
import janitor
import janitor.timeseries

from .et_calc import fao_etr_hourly as et_h, fao_etr_daily as et_d
from .params import params
from typing import List


def style_figure(fig, x_ticks):
    fig.update_layout(
        {"plot_bgcolor": "rgba(0, 0, 0, 0)"},
    )
    fig.update_xaxes(showgrid=True, gridcolor="grey")
    fig.update_yaxes(showgrid=True, gridcolor="grey")
    fig.update_layout(showlegend=False)

    # finish implementing this: https://stackoverflow.com/questions/63213050/plotly-how-to-set-xticks-for-all-subplots
    for ax in fig["layout"]:
        if ax[:5] == "xaxis":
            fig["layout"][ax]["range"] = x_ticks

    return fig


def merge_normal_data(v, df, station):
    v_short = params.short_name_mapper.get(v, None)
    if v_short:
        print()
        norm = [pd.read_csv(f"/app/normals/{station}_{x}.csv") for x in v_short]
        norm_l = len(norm)
        norm = pd.concat(norm, axis=0)
        norm = norm[norm["type"] == "daily"]
        if norm_l == 2:
            norm = (
                norm.select_columns("month", "day", "median", "variable")
                .pivot_wider(
                    index=["month", "day"], names_from="variable", values_from="median"
                )
                .dropna()
            )
            norm.columns = ["month", "day", "mn", "mx"]
            norm = norm.assign(avg=(norm.mn + norm.mx) / 2)
        else:
            norm = norm.select_columns("month", "day", "q25", "q75", "median")
            norm.columns = ["month", "day", "mn", "mx", "avg"]
        df = df.assign(month=df.datetime.dt.month)
        df = df.assign(day=df.datetime.dt.day)
        df = df.merge(norm, on=["month", "day"])
        df = df.assign(mn=np.where(df.datetime.dt.hour != 0, np.nan, df.mn))
        df = df.assign(mx=np.where(df.datetime.dt.hour != 0, np.nan, df.mx))
        df = df.assign(avg=np.where(df.datetime.dt.hour != 0, np.nan, df.avg))
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

    if "norm" in kwargs:
        dat = merge_normal_data(variable_text, dat, kwargs["station"])

    fig = px.line(dat, x="datetime", y=variable_text, markers=True)

    fig = fig.update_traces(line_color=kwargs["color"], connectgaps=False)

    variable_text = variable_text.replace("<br>", " ")

    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>" + variable_text + "</b>: %{y}",
    )

    if "norm" in kwargs:
        tmp = dat[["datetime", "mn", "mx", "avg"]].dropna()
        reference_line = go.Scatter(
            x=tmp.datetime,
            y=tmp.mx,
            mode="lines+markers",
            line=go.scatter.Line(color="yellow"),
            showlegend=False,
        )
        fig.add_trace(reference_line)
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


def plot_etr(hourly, station):

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
    lon = station["longitude"]
    elev = station["elevation"]

    calc_daily = (
        dat[dat.date.isin(gaps[gaps >= 20].index.values)]
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
    return fig

    # dat['et_h'] = (
    #     dat[dat.date.isin(gaps[gaps == 24].index.values)]
    #         .assign(julian=dat.datetime.dt.dayofyear)
    #         .assign(hour=dat.datetime.dt.hour)
    #         .apply(
    #             lambda x: et_h(
    #                 lat,
    #                 lon,
    #                 x["julian"],
    #                 x["hour"],
    #                 elev,
    #                 x["Relative Humidity [%]"],
    #                 (x["Air Temperature [°F]"] - 32) * (5/9),
    #                 x["Solar Radiation [W/m²]"],
    #                 x["Atmospheric Pressure [mbar]"]/10,
    #                 x["Wind Speed [mi/hr]"]*0.44704
    #             ) * (1/25.4),
    #             axis = 1
    #         )
    # )

    # dat = dat.assign(et_h=np.where(dat.et_h < 0, 0, dat.et_h))
    # calc_hourly = pd.DataFrame(
    #     dat.groupby(dat.date)["et_h"].agg("sum")
    # ).reset_index()


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


def plot_site(*args: List, dat: pd.DataFrame, ppt: pd.DataFrame, **kwargs):

    plots = []
    for v in args:
        if v == "ET":
            plt = plot_etr(hourly=dat, station=kwargs["station"])
        else:
            df = ppt if v == "Precipitation" else dat
            plot_func = get_plot_func(v)
            data = filter_df(df, v)
            if len(data) == 0:
                continue
            plt = plot_func(
                data, color=params.color_mapper[v], station=kwargs["station"]
            )
        plots.append(plt)

    sub = px_to_subplot(*plots, shared_xaxes=False)
    for row in range(1, len(plots) + 1):
        sub.update_yaxes(title_text=params.axis_mapper[args[row - 1]], row=row, col=1)

    height = 500 if len(plots) == 1 else 250 * len(plots)
    sub.update_layout(height=height)
    x_ticks = [
        dat.datetime.min().date() - rd(days=1),
        dat.datetime.max().date() + rd(days=1),
    ]
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
