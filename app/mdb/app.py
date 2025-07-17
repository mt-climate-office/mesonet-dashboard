import datetime as dt

import dash
import dash_bootstrap_components as dbc
import dash_mantine_components as dmc
import httpx
import polars as pl
import polars.selectors as cs
from dash import (
    Dash,
    Input,
    Output,
    State,
    _dash_renderer,
    callback,
    clientside_callback,
    dcc,
    html,
    no_update,
)
from dash_iconify import DashIconify

from mdb.layout import build_layout, create_forecast_widget
from mdb.utils import get_data as get
from mdb.utils import plotting

_dash_renderer._set_react_version("18.2.0")

app = Dash(
    external_stylesheets=dmc.styles.ALL,
    meta_tags=[
        {
            "name": "viewport",
            "content": "width=device-width, initial-scale=1.0, maximum-scale=1.2, minimum-scale=0.5,",
        }
    ],
    requests_pathname_prefix="/",
    external_scripts=[
        "https://www.googletagmanager.com/gtag/js?id=UA-149859729-3",
        "https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/develop/app/assets/gtag.js",
    ],
    name="MT Mesonet Dashboard",
    title="MT Mesonet Dashboard",
    assets_folder="assets",
)

app.layout = build_layout


@app.callback(
    Output("date-range", "value"),
    Output("por-button", "children"),
    Output("timescale-tabs", "value"),
    Input("por-button", "n_clicks"),
    State("por-button", "children"),
    State("stations-store", "data"),
    State("station-select", "value"),
    State("timescale-tabs", "value"),
)
def update_dates_to_por(
    n_clicks, button_lab, stations, selected_station, current_timescale
):
    stations = pl.from_dicts(stations)
    if n_clicks and n_clicks > 0:
        today = dt.date.today()
        if "Period" in button_lab:
            df = stations.filter(pl.col("station") == selected_station)
            dates = [df["date_installed"][0], today]
            new_title = "Select Last Two Weeks"
            if current_timescale != "daily":
                new_timescale = "daily"
            else:
                new_timescale = current_timescale
        else:
            dates = [today - dt.timedelta(weeks=2), today]
            new_title = "Select Period of Record"
            new_timescale = current_timescale
        return dates, new_title, new_timescale
    return no_update


@app.callback(
    Output("observations-store", "data"),
    Input("station-select", "value"),
    Input("page-tabs", "value"),
    Input("date-range", "value"),
    Input("timescale-tabs", "value"),
    Input("remove-flagged-switch", "checked"),
)
def update_observations_store(station, tab, dates, agg, rm_na):
    if station is not None and tab == "latest-data-tab":
        start_date, end_date = dates
        data = get.get_observations(station, start_date, end_date, agg, not rm_na)
        return data.to_dicts()
    return no_update


@app.callback(
    Output("station-metadata-content", "children"),
    Input("station-select", "value"),
    State("stations-store", "data"),
)
def update_station_metadata(station, stations):
    if station is None:
        return no_update
    selected_station = [x for x in stations if x["station"] == station]
    if len(selected_station) == 0:
        return html.B("The selected station has no associated metadata!")
    selected_station = selected_station[0]

    rows = []
    to_drop = ["mesowest_id", "gwic_id", "nwsli_id", "has_swp", "funded"]
    for k, v in selected_station.items():
        if k in to_drop:
            continue
        if "_" in k:
            k = k.replace("_", " ")
        k = k.title()
        if k == "Station":
            k = "Station Key"
        elif k == "Name":
            k = "Station Name"
        elif k == "Elevation":
            k = "Elevation (ft)"
            try:
                v = round(float(v) * 3.28084, 2)
            except (ValueError, TypeError):
                pass

        rows.append([k, v])

    return dmc.Table(
        children=[
            dmc.TableTbody(
                [dmc.TableTr([dmc.TableTh(x[0]), dmc.TableTd(x[1])]) for x in rows]
            )
        ],
        withColumnBorders=True,
        withTableBorder=True,
        highlightOnHover=True,
        layout="fixed",
        variant="vertical",
    )


@app.callback(
    Output("station-latest-content", "children"),
    Input("station-select", "value"),
)
def update_latest_station_table(station):
    if station is None:
        return no_update
    dat = get.get_latest(station)
    rows = [list(row.values()) for row in dat.to_dicts()]
    return dmc.TableScrollContainer(
        dmc.Table(
            children=[
                dmc.TableTbody(
                    [dmc.TableTr([dmc.TableTh(x[0]), dmc.TableTd(x[1])]) for x in rows]
                )
            ],
            withColumnBorders=True,
            withTableBorder=True,
            highlightOnHover=True,
            layout="fixed",
            variant="vertical",
            horizontalSpacing="lg",
        ),
        type="scrollarea",
        maxHeight=300,
        minWidth=600,
    )


@app.callback(
    Output("forecast-tab-content", "children"),
    Input("station-select", "value"),
    State("stations-store", "data"),
)
def update_station_forecast(station, stations):
    if station is None:
        return no_update
    station = [x for x in stations if x["station"] == station][0]
    forecast = get.get_forecast_data(station["latitude"], station["longitude"])
    return create_forecast_widget(forecast)


@app.callback(
    Output("latest-store", "data"),
    Input("station-select", "value"),
)
def update_latest_store(station: str):
    if station is None:
        return no_update
    dat = get.get_latest(station)
    return dat.to_dicts()


@callback(
    Output("appshell", "navbar"),
    Input("burger", "opened"),
    State("appshell", "navbar"),
)
def toggle_navbar(opened, navbar):
    navbar["collapsed"] = {"mobile": not opened}
    return navbar


@app.callback(
    Output("photo-tab", "disabled"),
    Input("station-select", "value"),
    State("stations-store", "data"),
)
def disable_photo_tab(station, stations):
    if station is None:
        return True
    sub_net = next(
        (x["sub_network"] for x in stations if x["station"] == station), "AgriMet"
    )
    return sub_net != "HydroMet"


@app.callback(
    Output("photo-chipgroup", "children"),
    Output("photo-datetimes", "data"),
    Output("photo-datetimes", "value"),
    Input("station-select", "value"),
    State("photo-store", "data"),
)
def update_photo_chips(station, photos):
    choices = {
        "N": "North",
        "S": "South",
        "E": "East",
        "W": "West",
        "SNOW": "Snow",
        "SS": "South Sky",
        "NS": "North Sky",
    }

    if station is None:
        return no_update, no_update, no_update
    photos = pl.from_dicts(photos)
    photos = photos.filter(pl.col("Station ID") == station)
    if len(photos) == 0:
        return no_update, no_update, no_update

    start_date = photos["Photo Start Date"].to_list()[0]
    now = dt.datetime.now()
    start = dt.datetime.strptime(start_date, "%Y-%m-%d")
    date_list = []
    current = start
    while current.date() <= now.date():
        for hour in [9, 15]:
            dt_point = current.replace(hour=hour, minute=0, second=0, microsecond=0)
            if dt_point <= now:
                date_list.append(dt_point.isoformat())
        current += dt.timedelta(days=1)

    date_out = [{"value": x, "label": x} for x in date_list]
    date_out = date_out[::-1]
    photos = photos["Photo Directions"].to_list()[0]
    return (
        [
            dmc.Chip(
                choices[x],
                value=x,
                icon=DashIconify(icon="fluent:camera-16-filled", width=9),
            )
            for x in photos
        ],
        date_out,
        date_out[0]["value"],
    )


@app.callback(
    Output("photo-container", "children"),
    Input("station-select", "value"),
    Input("photo-chipgroup", "value"),
    Input("photo-datetimes", "value"),
)
def update_selected_photo(station, direction, time):
    return dmc.Image(
        radius="md",
        src=f"https://mesonet.climate.umt.edu/api/photos/{station}/{direction.lower()}?dt={time}",
    )


@app.callback(
    Output("modal", "opened"),
    [Input("help-button", "n_clicks")],
    [State("modal", "opened")],
)
def toggle_modal(n1, is_open):
    if n1:
        return not is_open
    return is_open


@app.callback(
    Output("main-chart-panel", "children"),
    Input("observations-store", "data"),
    Input("element-multiselect", "value"),
    State("element-multiselect", "data"),
)
def update_main_chart(df, elements, elem_map):
    if df is None:
        return no_update

    df = pl.from_dicts(df, infer_schema_length=100000)

    plots = []
    for element in elements:
        elem_label = next((x["label"] for x in elem_map if x["value"] == element), None)
        if elem_label is None:
            # TODO: Create blank graph here
            continue
        tmp = df.select("datetime", cs.starts_with(elem_label))
        col_unit = next((x for x in tmp.columns if x != "datetime"), None)
        ylab = (
            elem_label + " " + col_unit.split(" ")[-1]
            if col_unit is not None
            else element
        )
        plots.append(dcc.Graph(figure=plotting.create_plot(tmp, ylab)))

    return dmc.ScrollArea(
        dmc.Stack(plots),
        type="hover",
        scrollbarSize=10,
        scrollHideDelay=1000,
        offsetScrollbars=True,
        h="75%",
    )


@app.callback(
    Output("wind-rose-panel", "children"), Input("observations-store", "data")
)
def create_wind_rose(data):
    data = pl.from_dicts(data, infer_schema_length=100000)
    return dcc.Graph(figure=plotting.plot_wind(data), style={"width": "100%"})


clientside_callback(
    """ 
    (switchOn) => {
       document.documentElement.setAttribute('data-mantine-color-scheme', switchOn ? 'dark' : 'light');  
       return window.dash_clientside.no_update
    }
    """,
    Output("color-scheme-toggle", "id"),
    Input("color-scheme-toggle", "checked"),
)

if __name__ == "__main__":
    app.run(debug=True)
