import datetime as dt
import os
import re
from itertools import chain, cycle
from pathlib import Path
from typing import Union
from urllib.error import HTTPError

import dash_bootstrap_components as dbc
import dash_loading_spinners as dls
import pandas as pd
from dash import (
    Dash,
    Input,
    Output,
    State,
    clientside_callback,
    ctx,
    dash_table,
    dcc,
    html,
    no_update,
)

from mdb import layout as lay
from mdb.utils import get_data as get
from mdb.utils import plot_satellite as plt_sat
from mdb.utils import plotting as plt
from mdb.utils import tables as tab
from mdb.utils.params import params

pd.options.mode.chained_assignment = None

on_server = os.getenv("ON_SERVER")

prefix = "/" if on_server is None or not on_server else "/dash/"

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
    requests_pathname_prefix=prefix,
    external_scripts=[
        "https://www.googletagmanager.com/gtag/js?id=UA-149859729-3",
        "https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/develop/app/assets/gtag.js",
    ],
)

app._favicon = "MCO_logo.svg"
server = app.server

# Make this a function so that it is refreshed on page load.
app.layout = lambda: lay.app_layout(app, get.get_sites())


@app.callback(
    Output("banner-title", "children"),
    [
        Input("station-dropdown", "value"),
        Input("main-display-tabs", "value"),
        State("mesonet-stations", "data"),
    ],
    prevent_initial_callback=True,
)
def update_banner_text(station: str, tab: str, stations) -> str:
    """Update the text of the banner to contain selected station's name.

    Args:
        station (str): The name of the station
        tab (str): The name of the tab selected.

    Returns:
        str: The banner title for the page.
    """
    stations = pd.read_json(stations, orient="records")
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
    Output("bl-tabs", "active_tab"),
    [
        Input("bl-tabs", "active_tab"),
        Input("station-dropdown", "value"),
        Input("temp-station-data", "data"),
        State("mesonet-stations", "data"),
    ],
)
def update_br_card(
    at: str, station: str, tmp_data: Union[int, str], stations: str
) -> Union[dcc.Graph, dash_table.DataTable]:
    """Update the card at the bottom right of the page.

    Args:
        at (str): The unique identifier of the tab that is selected.
        station (str): The station shortname that is selected.
        tmp_data (Union[int, str]): The Mesonet API data used to render plots.

    Returns:
        Union[dcc.Graph, dash_table.DataTable]: Depending on this selected tab, this is either a figure or a table.
    """
    stations = pd.read_json(stations, orient="records")

    if station == "" and at == "data-tab":
        at = "map-tab"
        switch_to_current = False
    else:
        switch_to_current = ctx.triggered_id == "station-dropdown"

    if at == "map-tab" and not switch_to_current:
        station_fig = plt.plot_station(stations, station=station)
        return dcc.Graph(id="station-fig", figure=station_fig), "map-tab"
    elif at == "meta-tab" and not switch_to_current:
        table = tab.make_metadata_table(stations, station)
        return dash_table.DataTable(data=table, **lay.TABLE_STYLING), "meta-tab"
    else:
        network = stations[stations["station"] == station]["sub_network"].values[0]

        if tmp_data != -1:
            out = []
            table = get.get_station_latest(station)
            out.append(
                dbc.Row(
                    [
                        dbc.Label(
                            html.B("Latest Data Summary"),
                            style={"text-align": "center"},
                        ),
                        dash_table.DataTable(table, **lay.TABLE_STYLING),
                    ],
                    justify="center",
                    className="h-50 mt-3",
                )
            )
            if network == "HydroMet":
                ppt = get.get_ppt_summary(station)
                out.append(
                    dbc.Row(
                        [
                            dbc.Label(
                                html.B("Precipitation Summary"),
                                style={"text-align": "center"},
                            ),
                            dash_table.DataTable(ppt, **lay.TABLE_STYLING),
                        ],
                        justify="center",
                        className="h-50",
                    )
                )
            out = dbc.Col(out, align="center"), "data-tab"
            return out
        return dcc.Graph(figure=plt.make_nodata_figure()), "meta-tab"


@app.callback(
    Output("data-download", "data"),
    Input("download-button", "n_clicks"),
    State("temp-station-data", "data"),
    State("station-dropdown", "value"),
    State("hourly-switch", "value"),
    State("dates", "start_date"),
    State("dates", "end_date"),
    prevent_initial_callback=True,
)
def download_called_data(n_clicks, tmp_data, station, time, start, end):
    if n_clicks and tmp_data:
        data = pd.read_json(tmp_data, orient="records")
        name = (
            f"{station}_{time}_{start.replace('-', '')}_to_{end.replace('-', '')}.csv"
        )
        return dcc.send_data_frame(data.to_csv, name)


@app.callback(
    [
        Output("select-vars", "options"),
        Output("select-vars", "value"),
    ],
    [Input("station-dropdown", "value"), State("select-vars", "value")],
)
def update_select_vars(station: str, selected):
    if not station or not selected:
        options = [{"value": x, "label": x} for x in sorted(params.default_vars)]
        values = [
            "Precipitation",
            "Reference ET",
            "Soil VWC",
            "Soil Temperature",
            "Air Temperature",
        ]
        return options, values
    elems = pd.read_csv(f"{params.API_URL}elements/{station}?type=csv")
    elems = elems["description_short"].tolist()
    elems = list(set([x.split("@")[0].strip() for x in elems]))
    elems.append("Reference ET")

    selected = [x for x in selected if x in elems]
    return [{"value": x, "label": x} for x in sorted(elems)], selected


@app.callback(
    Output("temp-station-data", "data"),
    [
        Input("station-dropdown", "value"),
        Input("dates", "start_date"),
        Input("dates", "end_date"),
        Input("hourly-switch", "value"),
        Input("select-vars", "value"),
        State("temp-station-data", "data"),
    ],
)
def get_latest_api_data(station: str, start, end, hourly, select_vars, tmp):
    if not station:
        return None
    start = dt.datetime.strptime(start, "%Y-%m-%d").date()
    end = dt.datetime.strptime(end, "%Y-%m-%d").date()

    select_vars += ["Wind Speed", "Wind Direction"]
    elements = set(chain(*[params.elem_map[x] for x in select_vars]))
    elements = list(set([y for y in params.elements for x in elements if x in y]))

    if tmp == -1 or not tmp or ctx.triggered_id in ["hourly-switch", "dates"]:
        if "etr" in elements:
            has_etr = True
            elements.remove("etr")
        else:
            has_etr = False
        try:
            out = get.get_station_record(
                station,
                start_time=start,
                end_time=end,
                period=hourly,
                e=",".join(elements),
                has_etr=has_etr,
            )
            out = out.to_json(date_format="iso", orient="records")
        except HTTPError:
            out = -1
        return out
    tmp = pd.read_json(tmp, orient="records")
    if tmp.station.values[0] != station:
        if "etr" in elements:
            has_etr = True
            elements.remove("etr")
        else:
            has_etr = False
        try:
            out = get.get_station_record(
                station,
                start_time=start,
                end_time=end,
                period=hourly,
                e=",".join(elements),
                has_etr=has_etr,
            )
            out = out.to_json(date_format="iso", orient="records")
        except HTTPError:
            out = -1
        return out
    existing_elements = set()
    for x in tmp.columns:
        x = re.sub("[\(\[].*?[\)\]]", "", x).strip()
        x = params.description_to_element.get(x, None)
        if x:
            existing_elements.update([x])

    elements = set(elements)
    new_elements = elements - existing_elements

    if "etr" in new_elements and "Reference ET (a=0.23) [in]" not in tmp.columns:
        has_etr = True
        new_elements.remove("etr")
    elif "etr" in new_elements and "Reference ET (a=0.23) [in]" in tmp.columns:
        has_etr = False
        new_elements.remove("etr")
    else:
        has_etr = False

    if new_elements:
        try:
            out = get.get_station_record(
                station,
                start_time=start,
                end_time=end,
                period=hourly,
                e=",".join(new_elements),
                has_etr=has_etr,
            )
        except HTTPError:
            return tmp.to_json(date_format="iso", orient="records")
    else:
        return tmp.to_json(date_format="iso", orient="records")
    tmp.datetime = pd.to_datetime(tmp.datetime)
    out.datetime = pd.to_datetime(out.datetime)

    out = tmp.merge(out, on=["station", "datetime"])
    return out.to_json(date_format="iso", orient="records")


@app.callback(
    Output("dates", "min_date_allowed"),
    Input("station-dropdown", "value"),
    State("mesonet-stations", "data"),
)
def adjust_start_date(station, stations):
    stations = pd.read_json(stations, orient="records")

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
        State("mesonet-stations", "data"),
    ],
)
def render_station_plot(tmp_data, select_vars, station, period, norm, stations):
    norm = [norm] if isinstance(norm, int) else norm
    if len(select_vars) == 0:
        return plt.make_nodata_figure("No variables selected")
    elif tmp_data and tmp_data != -1:
        stations = pd.read_json(stations, orient="records")
        data = pd.read_json(tmp_data, orient="records")
        data = data.assign(
            datetime=pd.to_datetime(data["datetime"], utc=True).dt.tz_convert(
                "America/Denver"
            )
        )
        data = get.clean_format(data)

        select_vars = [select_vars] if isinstance(select_vars, str) else select_vars
        station = stations[stations["station"] == station]

        return plt.plot_site(
            *select_vars,
            dat=data,
            station=station,
            norm=(len(norm) == 1) and (period == "daily"),
            top_of_hour=period != "raw",
        )
    elif tmp_data == -1:
        return plt.make_nodata_figure(
            """
            <b>No data available for selected station and dates</b> <br><br>
            
            Either change the date range or select a new station.
            """
        )

    return plt.make_nodata_figure(
        """
        <b>Select Station</b> <br><br>
        
        To get started, select a station from the dropdown above or the map to the right.
        """
    )


@app.callback(Output("station-dropdown", "value"), Input("url", "pathname"))
def update_dropdown_from_url(pth):
    stem = Path(pth).stem
    if stem == "/" or "dash" in stem:
        return None
    return stem


@app.callback(
    Output("ul-tabs", "children"),
    Input("station-dropdown", "value"),
    State("mesonet-stations", "data"),
)
def enable_photo_tab(station, stations):
    tabs = [
        dbc.Tab(label="Wind Rose", tab_id="wind-tab"),
        dbc.Tab(label="Weather Forecast", tab_id="wx-tab"),
    ]
    stations = pd.read_json(stations, orient="records")
    try:
        network = stations[stations["station"] == station]["sub_network"].values[0]
    except IndexError:
        return tabs
    if station and network == "HydroMet":
        tabs.append(dbc.Tab(label="Photos", tab_id="photo-tab"))

    return tabs


@app.callback(
    Output("ul-tabs", "active_tab"),
    Input("station-dropdown", "value"),
    State("mesonet-stations", "data"),
)
def select_default_tab(station, stations):
    stations = pd.read_json(stations, orient="records")
    try:
        network = stations[stations["station"] == station]["sub_network"].values[0]
    except IndexError:
        return "wind-tab"
    return "photo-tab" if station and network == "HydroMet" else "wind-tab"


@app.callback(
    Output("ul-content", "children"),
    [
        Input("ul-tabs", "active_tab"),
        Input("station-dropdown", "value"),
        Input("temp-station-data", "data"),
        State("mesonet-stations", "data"),
        # State("ul-content", "children"),
    ],
)
def update_ul_card(at, station, tmp_data, stations):
    # if at == "photo-tab" and ctx.triggered_id == "temp-station-data":
    #     return cur_content
    if station is None:
        return html.Div()
    if at == "wind-tab":
        if not tmp_data:
            return html.Div()
        if tmp_data != -1:
            data = pd.read_json(tmp_data, orient="records")
            data = data.rename(columns=params.lab_swap)
            data = data.assign(
                datetime=pd.to_datetime(data["datetime"], utc=True).dt.tz_convert(
                    "America/Denver"
                )
            )
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
        stations = pd.read_json(stations, orient="records")

        row = stations[stations["station"] == station]
        url = f"https://mobile.weather.gov/index.php?lon={row['longitude'].values[0]}&lat={row['latitude'].values[0]}"
        return html.Div(html.Iframe(src=url), className="second-row")

    else:
        tmp = pd.read_csv(
            f"https://mesonet.climate.umt.edu/api/v2/deployments/{station}/?type=csv"
        )
        tmp = tmp[tmp["type"] == "IP Camera"]
        if len(tmp) == 0:
            options = [
                {"value": "n", "label": "North"},
                {"value": "s", "label": "South"},
                {"value": "g", "label": "Ground"},
            ]
        else:
            cam = tmp.model.values[0]
            if cam == "EC-ScoutIP":
                options = [
                    {"value": "n", "label": "North"},
                    {"value": "s", "label": "South"},
                    {"value": "e", "label": "East"},
                    {"value": "w", "label": "West"},
                    {"value": "snow", "label": "Snow"},
                ]
            else:
                options = [
                    {"value": "n", "label": "North"},
                    {"value": "s", "label": "South"},
                    {"value": "ns", "label": "North Sky"},
                    {"value": "ss", "label": "South Sky"},
                ]

        buttons = dbc.RadioItems(
            id="photo-direction",
            options=options,
            inline=True,
            value="n",
        )

        if len(tmp) != 0:
            start = pd.to_datetime(tmp["date_start"].values[0])
            now = pd.Timestamp.utcnow().tz_convert("America/Denver")
            if now.strftime("%H%M") < "0930":
                # If it's before 930 there are no new photos yet.
                now -= pd.Timedelta(days=1)
            dts = (
                pd.date_range(start.tz_localize("America/Denver"), now)
                .strftime("%Y-%m-%d")
                .to_list()
            )
            dts = sorted(dts + dts)
            options = list(zip(dts, cycle(["Morning", "Afternoon"])))

            options = [x[0] + " " + x[1] for x in options]
            options = options[::-1]

            if now.strftime("%H%M") > "0930" and now.strftime("%H%M") < "1530":
                # Between 930 and 1530 only the morning photos are available.
                options = options[1:]
            values = [
                x.replace(" Morning", "T9:00").replace(" Afternoon", "T15:00")
                for x in options
            ]
            sel = dbc.Select(
                options=[{"label": k, "value": v} for k, v in zip(options, values)],
                id="photo-time",
                value=values[0],
            )
        else:
            val = pd.Timestamp.today().strftime("%Y-%m-%d")
            sel = (
                dbc.Select(
                    options=[{"label": val, "value": val}], id="photo-time", value=val
                ),
            )

        return html.Div(
            [
                dbc.Row(
                    [dbc.Col(buttons), dbc.Col(sel, width=4)],
                    justify="center",
                    align="center",
                    className="h-50",
                    style={"padding": "0rem 0rem 1rem 0rem"},
                ),
                html.Div(
                    dcc.Graph(
                        id="photo-figure",  # style={"height": "34vh", "width": "30vw"}
                    )
                ),
            ]
        )


@app.callback(Output("gridmet-switch", "options"), Input("hourly-switch", "value"))
def disable_gridmet_switch(period):
    if period != "daily": 
        return [{"label": "gridMET Normals", "value": 1, "disabled": True}]
    return [{"label": "gridMET Normals", "value": 1, "disabled": False}]


@app.callback(
    Output("photo-figure", "figure"),
    [
        Input("station-dropdown", "value"),
        Input("photo-direction", "value"),
        Input("photo-time", "value"),
    ],
)
def update_photo_direction(station, direction, dt):
    return plt.plot_latest_ace_image(station, direction=direction, dt=dt)


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


@app.callback(
    Output("main-content", "children"),
    Input("main-display-tabs", "value"),
    State("mesonet-stations", "data"),
)
def toggle_main_tab(sel, stations):
    stations = pd.read_json(stations, orient="records")

    if sel == "station-tab":
        station_fig = plt.plot_station(stations)
        return lay.build_latest_content(station_fig=station_fig, stations=stations)
    elif sel == "satellite-tab":
        return lay.build_satellite_content(stations)
    elif sel == "download-tab":
        station_fig = plt.plot_station(stations, zoom=5)
        station = stations["station"].values[0]
        station_elements = get.get_station_elements(station)
        return lay.build_downloader_content(
            station_fig, elements=station_elements, stations=stations, station=station
        )
    else:
        station_fig = plt.plot_station(stations)
        return lay.build_latest_content(station_fig=station_fig, stations=stations)


@app.callback(
    Output("station-dropdown", "options"),
    Input("network-options", "value"),
    State("mesonet-stations", "data"),
)
def subset_stations(opts, stations):
    stations = pd.read_json(stations, orient="records")

    if len(opts) == 0:
        sub = stations
    else:
        sub = stations[stations["sub_network"].str.contains("|".join(opts))]
    options = [
        {"label": k, "value": v} for k, v in zip(sub["long_name"], sub["station"])
    ]

    return options


@app.callback(
    [Output("satellite-selectors", "children"), Output("satellite-graph", "children")],
    Input("satellite-radio", "value"),
    State("mesonet-stations", "data"),
    State("station-dropdown-satellite", "value"),
)
def update_sat_selectors(sel, stations, station):
    if sel == "timeseries":
        graph = dls.Bars(dcc.Graph(id="satellite-plot"))
    else:
        graph = dls.Bars(dcc.Graph(id="satellite-compare"))
    stations = pd.read_json(stations, orient="records")

    return (
        lay.build_satellite_dropdowns(
            stations,
            sel == "timeseries",
            station=station,
            sat_compare_mapper=params.sat_compare_mapper,
        ),
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
        <b>Select Station</b> <br><br>
        
        To get started, select a station from the dropdown.
        """
        )

    if len(elements) == 0:
        return plt.make_nodata_figure(
            """
        <b>Select Indicator</b> <br><br>
        
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
        <b>Select Station</b> <br><br>
        
        To get started, select a station from the dropdown.
        """
        )
    if not (x_var and y_var):
        return plt.make_nodata_figure(
            """
        <b>Select Indicators</b> <br><br>
        
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
            <b>No Station Data Available</b> <br><br>
            
            Please select a new station variable.
            """
        )
    return plt_sat.plot_comparison(dat_x, dat_y, platform_x == "station")


@app.callback(
    Output("download-elements", "data"),
    Output("download-elements", "value"),
    Input("station-dropdown-dl", "value"),
    Input("dl-public", "checked"),
    State("download-elements", "value"),
)
def update_downloader_elements(station, public, elements):
    if station is None:
        return [], []

    elems_out = get.get_station_elements(station, public)
    if not elements:
        return elems_out, []

    poss_elems = [x["value"] for x in elems_out]
    elements = [x for x in elements if x in poss_elems]
    return elems_out, elements


@app.callback(
    Output("dl-start", "value"),
    Output("dl-start", "minDate"),
    Output("dl-end", "minDate"),
    Input("station-dropdown-dl", "value"),
    State("mesonet-stations", "data"),
)
def set_downloader_start_date(station, stations):
    if station is None:
        return no_update, no_update, no_update
    stations = pd.read_json(stations, orient="records")
    start = stations[stations["station"] == station]["date_installed"].values[0]
    return start, start, start


clientside_callback(
    """
    function updateLoadingState(n_clicks) {
        return true
    }
    """,
    Output("run-dl-request", "loading", allow_duplicate=True),
    Input("run-dl-request", "n_clicks"),
    prevent_initial_call=True,
)


@app.callback(
    Output("dl-data", "data"),
    Output("run-dl-request", "loading"),
    Output("dl-alert", "hide", allow_duplicate=True),
    Input("run-dl-request", "n_clicks"),
    State("station-dropdown-dl", "value"),
    State("download-elements", "value"),
    State("dl-start", "value"),
    State("dl-end", "value"),
    State("dl-timeperiod", "value"),
    prevent_initial_call=True,
)
def downloader_data(n_clicks, station, elements, start, end, period):
    if n_clicks and (not station or not elements):
        return no_update, False, False
    if start is None or station is None:
        return no_update, no_update, True

    start = dt.datetime.strptime(start, "%Y-%m-%d").date()
    end = dt.datetime.strptime(end, "%Y-%m-%d").date()
    if n_clicks:
        data = get.get_station_record(
            station,
            start,
            end,
            period,
            ",".join(elements),
            has_etr=False,
            na_info=True,
            public=False,
        )
        data = data.rename(columns={"has_na": "Contains Missing Data"})
        if "bp_logger_0244" not in elements:
            try:
                data = data.drop(columns=["Logger Reference Pressure [mbar]"])
            except KeyError:
                pass
        return (
            data.to_json(date_format="iso", orient="records"),
            False,
            True,
        )


clientside_callback(
    """
    function updateLoadingState(n_clicks) {
        return true
    }
    """,
    Output("dl-data-button", "loading", allow_duplicate=True),
    Input("dl-data-button", "n_clicks"),
    prevent_initial_call=True,
)


@app.callback(
    Output("downloader-data", "data"),
    Output("dl-alert", "hide", allow_duplicate=True),
    Output("dl-data-button", "loading"),
    Input("dl-data-button", "n_clicks"),
    State("dl-data", "data"),
    State("station-dropdown-dl", "value"),
    State("dl-start", "value"),
    State("dl-end", "value"),
    State("dl-timeperiod", "value"),
    prevent_initial_call=True,
)
def download_data(n_clicks, data, station, start, end, period):
    if n_clicks and not data:
        return no_update, False, False
    if n_clicks:
        data = pd.read_json(data, orient="records")
        name = f"{station}_{period}_{str(start).replace('-', '')}_to_{str(end).replace('-', '')}.csv"
        return dcc.send_data_frame(data.to_csv, name), True, False


@app.callback(
    Output("dl-alert", "children"),
    Input("dl-data-button", "n_clicks"),
    Input("run-dl-request", "n_clicks"),
)
def change_alert_text(dl_button, req_button):
    if ctx.triggered_id == "dl-data-button":
        return "Please 'Run Request' before attempting to download."
    return "Please select a station and variable first!"


@app.callback(
    Output("station-dropdown-dl", "value"),
    Input("download-map", "clickData"),
)
def select_station_from_map(clickData):
    if clickData:
        lat, lon, name, elevation, href, station, color = clickData["points"][0][
            "customdata"
        ]
        station = station.split(",")[0]
        return station


@app.callback(
    Output("dl-plots", "children"),
    Input("dl-data", "data"),
)
def plot_downloaded_data(data):
    if data is None:
        return no_update

    rm_cols = ["station", "datetime", "Contains Missing Data"]

    data = pd.read_json(data, orient="records")
    use_cols = [x for x in data.columns if x not in rm_cols]
    out = []
    for col in use_cols:
        tmp = data[["datetime", col]]
        tmp_plot = dcc.Graph(figure=plt.make_single_plot(tmp))

        out.append(tmp_plot)

    return out


if __name__ == "__main__":
    app.run_server(debug=True)
