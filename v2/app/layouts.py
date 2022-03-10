from dash import dcc, html
from libs.get_data import get_sites
from libs.plotting import plot_stations
from pathlib import Path

stations = get_sites()

station_map_page = html.Div(
    [
        html.H2("Welcome to the Montana Mesonet dashboard!"),
        html.H4("Select a station from the map or dropdown to view its data."),
        dcc.Dropdown(
            dict(
                zip(
                    (Path("station") / stations["station"]).astype(str),
                    stations["long_name"],
                )
            ),
            id="station-dropdown",
        ),
        dcc.Graph(id="station-data", figure=plot_stations(stations)),
    ]
)

site_page = html.Div(
    [
        html.Div(id="selected-site"),
    ]
)
