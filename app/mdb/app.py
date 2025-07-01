import datetime as dt

import dash
import dash_bootstrap_components as dbc
import dash_mantine_components as dmc
import httpx
import polars as pl
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

from mdb.layout import build_layout, create_forecast_widget
from mdb.utils import get_data as get

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
        print(data)
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
    selected_station = [x for x in stations if x['station'] == station]
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
        k = "    " + k
        rows.append([k, v])

    return dmc.Table(
        data={
            "body": rows,
        },
        striped=True,
        withColumnBorders=True,
        withTableBorder=True,
        highlightOnHover=True
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
    return dmc.Table(
        data={
            "head": ["Variable", "Value"],
            "body": rows,
        },
        striped=True,
        withColumnBorders=True,
        withTableBorder=True,
        highlightOnHover=True
    )

@app.callback(
    Output("forecast-tab-content", "children"),
    Input("station-select", "value"),
    State("stations-store", "data")
)
def update_station_forecast(station, stations):
    if station is None:
        return no_update
    station = [x for x in stations if x['station'] == station][0]
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


@callback(
    Output("advanced-options-collapse", "opened"),
    Input("advanced-options-toggle", "n_clicks"),
)
def toggle_advanced_options(n):
    print(n)
    if n % 2 == 0:
        return False
    return True


@app.callback(
    Output("modal", "opened"),
    [Input("help-button", "n_clicks")],
    [State("modal", "opened")],
)
def toggle_modal(n1, is_open):
    if n1:
        return not is_open
    return is_open


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
