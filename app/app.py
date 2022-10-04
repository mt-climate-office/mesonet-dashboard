import datetime as dt
from pathlib import Path
from typing import Union

import dash_bootstrap_components as dbc
import dash_loading_spinners as dls
import pandas as pd
from dash import Dash, Input, Output, State, dash_table, dcc, html
from dateutil.relativedelta import relativedelta as rd
from urllib.error import HTTPError
from itertools import chain
import re

# from .libs import get_data as get
# from .libs import plotting as plt
# from .libs import tables as tab
# from .libs.params import params
# from . import layout as lay

import libs.get_data as get
import libs.plotting as plt
import libs.tables as tab
import layout as lay
from libs.params import params


pd.options.mode.chained_assignment = None


app = Dash(
    __name__,
    title="Montana Mesonet",
    suppress_callback_exceptions=True,
    external_stylesheets=[dbc.themes.BOOTSTRAP],
    meta_tags=[
        {
            "name": "viewport",
            "content": "width=device-width, initial-scale=1.0, maximum-scale=1.2, minimum-scale=0.5,",
        }
    ],
    # requests_pathname_prefix="/dash_mobile/",
    external_scripts=[
        "https://www.googletagmanager.com/gtag/js?id=UA-149859729-3",
        "https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/develop/app/assets/gtag.js",
    ],
)

app._favicon = "MCO_logo.svg"
server = app.server

stations = get.get_sites()
app.layout = lay.app_layout(app_ref=app, stations=stations)


def render_station_plot(station, data):

    

    return plt.plot_site(
        *select_vars,
        dat=dat,
        ppt=ppt,
        station=station,
        norm=False,
        top_of_hour=True,
    )


def weather_iframe(station):
    row = stations[stations["station"] == station]
    url = f"https://mobile.weather.gov/index.php?lon={row['longitude'].values[0]}&lat={row['latitude'].values[0]}"
    return (
        html.Iframe(
            src=url,
            style={
                "flex-grow": "1",
                "border": "none",
                "margin": "0",
                "padding": "0",
            },
        ),
    )


@app.callback(
    Output("main-content", "children"),
    [
        Input("station-dropdown", "value"),
        Input("tabs", "active_tab"),
        Input("data", "data")
    ],
)
def toggle_main_tab(station, tab, data):

    if not station and tab != "map":
        return dcc.Graph(figure=plt.make_nodata_figure("<b>No Station Selected!</b>"))
    match tab:
        case "current":
            title, table = get.get_station_latest(station)
            return html.Div(
                [
                    html.Label(f"Data from {title}"),
                    dash_table.DataTable(data=table, **lay.TABLE_STYLING),
                ]
            )

        case "plot":
            out = render_station_plot(station=station, data=data)
            return dcc.Graph(figure=out)
        case "forecast":
            return weather_iframe(station)
        case "map":
            station_fig = plt.plot_station(stations, station=station)
            return dcc.Graph(id="station-fig", figure=station_fig)
        case _:
            return html.Div("uh oh!")

def get_data(station, elements):

    end = dt.date.today()
    start = end - rd(days=7)

    return get.get_station_record(station, start, end, True, ",".join(elements))

@app.callback(
    Output("data", "data"),
    Input("station-dropdown", "value"),
    Input("select", "value"),
    State("data", "data"),
)
def update_station_data(station, vars, tmp):

    if not station or not vars:
        return None

    elements = set(chain(*[params.elem_map[x] for x in vars]))
    elements = list(set([y for y in params.elements for x in elements if x in y]))
    if not tmp:
        out = get_data(station, elements)
        return out.to_json(date_format="iso", orient="records")
    
    tmp = pd.read_json(tmp, orient="records")

    if tmp.station.values[0] != station:
        out = get_data(station, elements)
        return out.to_json(date_format="iso", orient="records")

    existing_elements = set()
    for x in tmp.columns:
        x = re.sub("[\(\[].*?[\)\]]", "", x).strip()
        x = params.description_to_element.get(x, None)
        if x:
            existing_elements.update([x])

    elements = set(elements)
    new_elements = elements - existing_elements
    if new_elements:
        try:
            out = get_data(station, new_elements)
        except HTTPError:
            return tmp.to_json(date_format="iso", orient="records")
    else:
        return tmp.to_json(date_format="iso", orient="records")
    
    tmp.datetime = pd.to_datetime(tmp.datetime)
    out.datetime = pd.to_datetime(out.datetime)

    out = tmp.merge(out, on=["station", "datetime"])
    return out.to_json(date_format="iso", orient="records")


@app.callback(
    Output("to-hide", "style"),
    Input("tabs", "active_tab"),
    prevent_initial_callback=True,
)
def hide_select(tab):
    vis = "visible" if tab == "plot" else "hidden"
    height = "50px" if tab == "plot" else "0px"
    return {"visibility": vis, "height": height}


@app.callback(
    Output("banner-title", "children"),
    [Input("station-dropdown", "value")],
    prevent_initial_callback=True,
)
def update_banner_text(station: str) -> str:
    """Update the text of the banner to contain selected station's name.

    Args:
        station (str): The name of the station

    Returns:
        str: The banner title for the page.
    """
    try:
        return (
            f"Mesonet Dashboard: {stations[stations['station'] == station].name.values[0]}"
            if station != ""
            else "Mesonet Dashboard"
        )
    except IndexError:
        return "Mesonet Dashboard"


@app.callback(Output("station-dropdown", "value"), Input("url", "pathname"))
def update_dropdown_from_url(pth):
    stem = Path(pth).stem
    if stem == "/" or "dash" in stem:
        return None
    return stem


@app.callback(
    [Output("station-modal", "children"), Output("station-modal", "is_open")],
    [Input("station-fig", "clickData")],
    [State("station-modal", "is_open")],
)
def station_popup(clickData, is_open):
    if clickData:
        lat, lon, name, elevation, href, _, _ = clickData["points"][0]["customdata"]
        name = name.replace(",<br>", ", ")
        text = dbc.ModalBody(
            dcc.Markdown(
                f"""
            #### {name}
            **Latitude, Longitude**: {lat}, {lon}

            **Elevation (m)**: {elevation}

            ###### View Station Dashboard
            {href}
            """
            )
        )

    if clickData and text:
        return text, not is_open
    return "", is_open


@app.callback(
    Output("modal", "is_open"),
    [Input("help-button", "n_clicks")],
    [State("modal", "is_open")],
)
def toggle_modal(n1, is_open):

    if n1:
        return not is_open
    return is_open


if __name__ == "__main__":
    app.run_server(debug=True)
