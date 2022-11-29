import datetime as dt
from pathlib import Path
from typing import Union

import dash_bootstrap_components as dbc
import dash_loading_spinners as dls
import pandas as pd
from dash import Dash, Input, Output, State, dash_table, dcc, html
from dateutil.relativedelta import relativedelta as rd
from urllib.error import HTTPError

from .libs import get_data as get
from .libs import plotting as plt
from .libs import tables as tab
from .libs.params import params
from .libs import plot_satellite as plt_sat
from . import layout as lay

# import libs.get_data as get
# import libs.plotting as plt
# import libs.tables as tab
# import layout as lay
# from libs.params import params
# import libs.plot_satellite as plt_sat


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
    requests_pathname_prefix="/dash/",
    external_scripts=[
        "https://www.googletagmanager.com/gtag/js?id=UA-149859729-3",
        "https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/develop/app/assets/gtag.js",
    ],
)

app._favicon = "MCO_logo.svg"
server = app.server

stations = get.get_sites()
app.layout = lay.app_layout(app_ref=app)


@app.callback(
    Output("banner-title", "children"),
    [Input("station-dropdown", "value"), Input("main-display-tabs", "value")],
    prevent_initial_callback=True,
)
def update_banner_text(station: str, tab: str) -> str:
    """Update the text of the banner to contain selected station's name.

    Args:
        station (str): The name of the station
        tab (str): The name of the tab selected.

    Returns:
        str: The banner title for the page. 
    """
    try:
        return (
            f"The Montana Mesonet Dashboard: {stations[stations['station'] == station].name.values[0]}"
            if station != "" and tab == "station-tab"
            else "The Montana Mesonet Dashboard"
        )
    except IndexError:
        return "The Montana Mesonet Dashboard"


@app.callback(
    Output("bl-content", "children"),
    [
        Input("bl-tabs", "active_tab"),
        Input("station-dropdown", "value"),
        Input("temp-station-data", "data"),
    ],
)
def update_br_card(at: str, station: str, tmp_data: Union[int, str]) -> Union[dcc.Graph, dash_table.DataTable]:
    """Update the card at the bottom right of the page. 

    Args:
        at (str): The unique identifier of the tab that is selected.
        station (str): The station shortname that is selected.
        tmp_data (Union[int, str]): The Mesonet API data used to render plots. 

    Returns:
        Union[dcc.Graph, dash_table.DataTable]: Depending on this selected tab, this is either a figure or a table.
    """
    if at == "map-tab":
        station_fig = plt.plot_station(stations, station=station)
        return dcc.Graph(id="station-fig", figure=station_fig)
    elif at == "meta-tab":
        table = tab.make_metadata_table(stations, station)
        return dash_table.DataTable(data=table, **lay.TABLE_STYLING)

    else:
        if tmp_data != -1:
            table = get.get_station_latest(station)
            return dash_table.DataTable(data=table, **lay.TABLE_STYLING)
        return dcc.Graph(figure=plt.make_nodata_figure())


@app.callback(
    Output("temp-station-data", "data"),
    [
        Input("station-dropdown", "value"),
        Input("start-date", "date"),
        Input("end-date", "date"),
        Input("hourly-switch", "value"),
    ],
)
def get_latest_api_data(station: str, start, end, hourly):

    if (start or end) and station:
        start = dt.datetime.strptime(start, "%Y-%m-%d").date()
        end = dt.datetime.strptime(end, "%Y-%m-%d").date()

        hourly = [hourly] if isinstance(hourly, int) else hourly

        try:
            data = get.clean_format(
                station, start_time=start, end_time=end, hourly=len(hourly) == 1
            )
        except (AttributeError, HTTPError) as e:
            print(e)
            return -1
        return data.to_json(date_format="iso", orient="records")


@app.callback(Output("start-date", "disabled"), Input("station-dropdown", "value"))
def enable_start_date(station):
    return station is None


@app.callback(Output("end-date", "disabled"), Input("station-dropdown", "value"))
def enable_end_date(station):
    return station is None


@app.callback(Output("end-date", "max_date_allowed"), [Input("start-date", "date")])
def adjust_end_date_max(value):
    d = dt.datetime.strptime(value, "%Y-%m-%d").date()
    return d + rd(weeks=2)


@app.callback(Output("end-date", "date"), [Input("start-date", "date")])
def adjust_end_date_select(value):
    d = dt.datetime.strptime(value, "%Y-%m-%d").date()
    return d + rd(weeks=2)


@app.callback(Output("start-date", "date"), Input("station-dropdown", "value"))
def reset_start_date(value):
    return dt.date.today() - rd(weeks=2)


@app.callback(Output("end-date", "min_date_allowed"), [Input("start-date", "date")])
def adjust_end_date_max(value):
    d = dt.datetime.strptime(value, "%Y-%m-%d").date()
    return d


@app.callback(
    Output("start-date", "min_date_allowed"), Input("station-dropdown", "value")
)
def adjust_start_date(station):
    if station:
        d = stations[stations["station"] == station]["date_installed"].values[0]
        return dt.datetime.strptime(d, "%Y-%m-%d").date()


@app.callback(Output("date-button", "disabled"), Input("station-dropdown", "value"))
def enable_date_button(station):
    return station is None


@app.callback(
    Output("station-data", "figure"),
    [
        Input("temp-station-data", "data"),
        Input("select-vars", "value"),
        Input("station-dropdown", "value"),
        Input("hourly-switch", "value"),
        Input("gridmet-switch", "value"),
    ],
)
def render_station_plot(tmp_data, select_vars, station, hourly, norm):
    hourly = [hourly] if isinstance(hourly, int) else hourly
    norm = [norm] if isinstance(norm, int) else norm

    if len(select_vars) == 0:
        return plt.make_nodata_figure("No variables selected")
    elif tmp_data and tmp_data != -1:
        data = pd.read_json(tmp_data, orient="records")
        data.datetime = data.datetime.dt.tz_convert("America/Denver")
        if len(hourly) == 1:
            data = get.filter_top_of_hour(data)

        dat = data.drop(columns="Precipitation [in]")
        ppt = data[["datetime", "Precipitation [in]"]]
        ppt = ppt.dropna()
        select_vars = [select_vars] if isinstance(select_vars, str) else select_vars
        station = stations[stations["station"] == station]

        return plt.plot_site(
            *select_vars,
            dat=dat,
            ppt=ppt,
            station=station,
            norm=len(norm) == 1,
            top_of_hour=len(hourly) == 1,
        )
    elif tmp_data == -1:
        return plt.make_nodata_figure(
            """
            <b>No data available for selected station and dates!</b> <br><br>
            
            Either change the date range or select a new station.
            """
        )

    return plt.make_nodata_figure(
        """
        <b>No station selected!</b> <br><br>
        
        To get started, select a station from the dropdown above or the map to the right.
        """
    )


@app.callback(Output("station-dropdown", "value"), Input("url", "pathname"))
def update_dropdown_from_url(pth):
    stem = Path(pth).stem
    if stem == "/" or "dash" in stem:
        return None
    return stem


@app.callback(Output("ul-tabs", "children"), Input("station-dropdown", "value"))
def enable_photo_tab(station):
    tabs = [
        dbc.Tab(label="Wind Rose", tab_id="wind-tab"),
        dbc.Tab(label="Weather Forecast", tab_id="wx-tab"),
    ]

    if station and station[:3] == "ace":
        tabs.append(dbc.Tab(label="Latest Photo", tab_id="photo-tab"))

    return tabs


@app.callback(Output("ul-tabs", "active_tab"), Input("station-dropdown", "value"))
def select_default_tab(station):
    return "photo-tab" if station and station[:3] == "ace" else "wind-tab"


@app.callback(
    Output("ul-content", "children"),
    [
        Input("ul-tabs", "active_tab"),
        Input("station-dropdown", "value"),
        Input("temp-station-data", "data"),
    ],
)
def update_ul_card(at, station, tmp_data=None):
    if station is None:
        return html.Div()
    if at == "wind-tab":
        if not tmp_data:
            return html.Div()
        if tmp_data != -1:
            data = pd.read_json(tmp_data, orient="records")
            data.datetime = data.datetime.dt.tz_convert("America/Denver")
            start_date = data.datetime.min().date()
            end_date = data.datetime.max().date()

            data = data[["Wind Direction [deg]", "Wind Speed [mi/hr]"]]
            fig = plt.plot_wind(data)
            fig.update_layout(
                title={
                    "text": f"<b>Wind Data from {start_date} to {end_date}</b>",
                    "x": 0.5,
                    "y": 1.0,
                    "xanchor": "center",
                    "yanchor": "top",
                    "font": dict(
                        family="Courier New, monospace", size=15, color="Black"
                    ),
                }
            )

            return (html.Div(children=dcc.Graph(figure=fig, style={"height": "40vh"})),)
        return (
            html.Div(
                dcc.Graph(
                    figure=plt.make_nodata_figure(
                        "<b>No data available for selected dates.</b>"
                    ),
                    style={"height": "40vh"},
                )
            ),
        )

    elif at == "wx-tab":
        row = stations[stations["station"] == station]
        url = f"https://mobile.weather.gov/index.php?lon={row['longitude'].values[0]}&lat={row['latitude'].values[0]}"
        return html.Div(html.Iframe(src=url), className="second-row")

    else:
        buttons = dbc.RadioItems(
            id="photo-direction",
            options=[
                {"value": "n", "label": "North"},
                {"value": "s", "label": "South"},
                {"value": "g", "label": "Ground"},
            ],
            inline=True,
            value="n",
        )

        return html.Div(
            [
                dbc.Row(buttons, justify="center", align="center", className="h-50"),
                html.Div(
                    dcc.Graph(
                        id="photo-figure", style={"height": "34vh", "width": "30vw"}
                    )
                ),
            ]
        )


@app.callback(
    Output("photo-figure", "figure"),
    [Input("station-dropdown", "value"), Input("photo-direction", "value")],
)
def update_photo_direction(station, direction):
    return plt.plot_latest_ace_image(station, direction=direction)


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


@app.callback(
    Output("feedback-modal", "is_open"),
    [Input("feedback-button", "n_clicks")],
    [State("feedback-modal", "is_open")],
)
def toggle_feedback(n1, is_open):

    if n1:
        return not is_open
    return is_open


@app.callback(Output("main-content", "children"), [Input("main-display-tabs", "value")])
def toggle_main_tab(sel):

    if sel == "station-tab":
        station_fig = plt.plot_station(stations)
        return lay.build_latest_content(station_fig=station_fig, stations=stations)
    elif sel == "satellite-tab":
        return lay.build_satellite_content(stations)
    else:
        station_fig = plt.plot_station(stations)
        return lay.build_latest_content(station_fig=station_fig, stations=stations)


@app.callback(
    Output("station-dropdown", "options"),
    Input("network-options", "value"),
)
def subset_stations(opts):
    
    if len(opts) == 0:
       sub = stations
    else: 
        sub = stations[stations["sub_network"].str.contains("|".join(opts))]
    options=[
        {"label": k, "value": v}
        for k, v in zip(sub["long_name"], sub["station"])
    ]

    return options


@app.callback(
    [Output("satellite-selectors", "children"), Output("satellite-graph", "children")],
    Input("satellite-radio", "value"),
    State("station-dropdown-satellite", "value"),
)
def update_sat_selectors(sel, station):
    if sel == "timeseries":
        graph = dls.Bars(dcc.Graph(id="satellite-plot"))
    else:
        graph = dls.Bars(dcc.Graph(id="satellite-compare"))

    return (
        lay.build_satellite_dropdowns(stations, sel == "timeseries", station=station, sat_compare_mapper=params.sat_compare_mapper),
        graph,
    )


@app.callback(
    Output("satellite-plot", "figure"),
    [
        Input("station-dropdown-satellite", "value"),
        Input("sat-vars", "value"),
        Input("climatology-switch", "value"),
    ],
    prevent_initial_callback=True,
)
def render_satellite_ts_plot(station, elements, climatology):

    if station is None:
        return plt.make_nodata_figure(
            """
        <b>No station selected!</b> <br><br>
        
        To get started, select a station from the dropdown.
        """
        )

    if len(elements) == 0:
        return plt.make_nodata_figure(
            """
        <b>No indicators selected!</b> <br><br>
        
        Select an indicator from the checkbox to view the plot. 
        """
        )

    start_time = dt.date(2000, 1, 1)
    end_time = dt.date.today()
    dfs = {
        x: get.get_satellite_data(
            station=station, element=x, start_time=start_time, end_time=end_time
        )
        for x in elements
    }

    return plt_sat.plot_all(dfs, climatology=climatology)


@app.callback(
    Output("compare1", "options"), Input("station-dropdown-satellite", "value")
)
def update_compare2_options(station):
    options = [
        {"label": " ", "value": " ", "disabled": True},
        {
            "label": "SATELLITE VARIABLES",
            "value": "SATELLITE VARIABLES",
            "disabled": True,
        },
        {"label": "-" * 30, "value": "-" * 30, "disabled": True},
    ]
    options += [{"label": k, "value": v} for k, v in params.sat_compare_mapper.items()]
    if station is None:
        return options

    station_elements = pd.read_csv(
        f"https://mesonet.climate.umt.edu/api/v2/elements/{station}/?type=csv"
    )
    station_elements = station_elements.sort_values("description_short")
    elements = [
        {"label": "STATION VARIABLES", "value": "STATION VARIABLES", "disabled": True},
        {"label": "-" * 32, "value": "-" * 32, "disabled": True},
    ]
    elements += [
        {"label": k, "value": f"{v}-station"}
        for k, v in zip(station_elements.description_short, station_elements.element)
    ]
    elements += options
    return elements


@app.callback(
    Output("satellite-compare", "figure"),
    [
        Input("station-dropdown-satellite", "value"),
        Input("compare1", "value"),
        Input("compare2", "value"),
        Input("start-date-satellite", "date"),
        Input("end-date-satellite", "date"),
    ],
)
def render_satellite_comp_plot(station, x_var, y_var, start_time, end_time):

    start_time = dt.datetime.strptime(start_time, "%Y-%m-%d").date()
    end_time = dt.datetime.strptime(end_time, "%Y-%m-%d").date()

    if station is None:
        return plt.make_nodata_figure(
            """
        <b>No station selected!</b> <br><br>
        
        To get started, select a station from the dropdown.
        """
        )
    if not (x_var and y_var):
        return plt.make_nodata_figure(
            """
        <b>No indicators selected!</b> <br><br>
        
        Please select two indicators to view the plot. 
        """
        )

    element_x, platform_x = x_var.split("-")
    element_y, platform_y = y_var.split("-")

    try: 
        if platform_x == "station":

            dat_x, dat_y = get.get_sat_compare_data(
                station=station,
                sat_element=element_y,
                station_element=element_x,
                start_time=start_time,
                end_time=end_time,
                platform=platform_y,
            )
            dat_x = dat_x.assign(element=dat_x.columns[0])
            dat_x = dat_x.assign(platform=platform_x)
            dat_x.columns = ["value", "date", "element", "platform"]

        else: 
            dat_x = get.get_satellite_data(
                station=station,
                element=element_x,
                start_time=start_time,
                end_time=end_time,
                platform=platform_x,
                modify_dates=False,
            )
            dat_y = get.get_satellite_data(
                station=station,
                element=element_y,
                start_time=start_time,
                end_time=end_time,
                platform=platform_y,
                modify_dates=False,
            )

    except HTTPError:
        return plt.make_nodata_figure(
            """
            <b>No Station Data Available!</b> <br><br>
            
            Please select a new station variable.
            """
        )
    return plt_sat.plot_comparison(dat_x, dat_y, platform_x == "station")


if __name__ == "__main__":
    app.run_server(debug=True)
