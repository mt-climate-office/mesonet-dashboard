import datetime as dt
import json
import os
import re
from itertools import chain, cycle
from pathlib import Path
from typing import Union
from urllib.error import HTTPError
from urllib.parse import parse_qs

import dash_bootstrap_components as dbc
import dash_mantine_components as dmc
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
from mdb.utils import plot_derived as plt_der
from mdb.utils import plot_satellite as plt_sat
from mdb.utils import plotting as plt
from mdb.utils import tables as tab
from mdb.utils.params import params
from mdb.utils.update import DashShare, update_component_state

pd.options.mode.chained_assignment = None

on_server = os.getenv("ON_SERVER")

prefix = "/" if on_server is None or not on_server else "/dash/"

app = Dash(
    __name__,
    title="Montana Mesonet",
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
app.config["suppress_callback_exceptions"] = True
app.config["prevent_initial_callbacks"] = "initial_duplicate"
server = app.server


def make_station_iframe(station="none"):
    return html.Div(
        html.Iframe(
            src=f"https://mesonet.climate.umt.edu/api/map/stations/?station={station}"
        ),
        className="second-row",
    )


def parse_query_string(query_string):
    query_string = query_string.replace("?", "")
    parsed_data = parse_qs(query_string)
    result_dict = {key: value[0] for key, value in parsed_data.items()}
    return result_dict


class FileShare(DashShare):
    def load(self, input, state):
        q = parse_query_string(input)
        if "state" in q:
            try:
                with open(f"./share/{q['state']}.json", "rb") as file:
                    state = json.load(file)
            except FileNotFoundError:
                return state
            state = update_component_state(
                state, None, **{self.modal_id: {"is_open": False}}
            )
        return state

    def save(self, input, state, hash):
        out_dir = Path("./share")

        if not out_dir.exists():
            out_dir.mkdir()

        if Path(f"./{out_dir}/{hash}.json").exists():
            return input

        if input is not None and input > 0:
            state = update_component_state(
                state,
                None,
                temp_station_data={"data": -1},
                dl_data={"data": None},
                dl_plots={"figure": {}},
                temp_derived_data={"data": None},
                station_data={"figure": {}},
                derived_plot={"figure": {}},
                satellite_plot={"figure": {}},
                satellite_compare={"figure": {}},
                station_fig={"figure": {}},
                save_modal={"is_open": False},
                download_map={"figure": {}},
            )

            with open(f"./{out_dir}/{hash}.json", "w") as json_file:
                json.dump(state, json_file, indent=4)
        return input


tracker = FileShare(
    app=app,
    load_input=("url", "search"),
    save_input=("test-button", "n_clicks"),
    save_output=("test-button", "n_clicks"),
    url_input="url",
)
# Make this a function so that it is refreshed on page load.
app.layout = lambda: dmc.MantineProvider(tracker.update_layout(lay.app_layout(app, get.get_sites())), id="mantine-provider", forceColorScheme="light")
tracker.register_callbacks()


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
        station_name = station if station is not None else "none"
        return make_station_iframe(station_name), "map-tab"
    elif at == "meta-tab" and not switch_to_current:
        table = tab.make_metadata_table(stations, station)
        return dash_table.DataTable(data=table, **lay.TABLE_STYLING), "meta-tab"
    else:
        try:
            network = stations[stations["station"] == station]["sub_network"].values[0]
        except IndexError:
            return no_update
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
                ppt = ppt[::-1]
                if ppt:
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
@tracker.pause_update
def update_select_vars(station: str, selected):
    if not selected:
        selected = [
            "Precipitation",
            "Reference ET",
            "Soil VWC",
            "Soil Temperature",
            "Air Temperature",
        ]
    if not station:
        options = [{"value": x, "label": x} for x in sorted(params.default_vars)]
        return options, selected

    elems = pd.read_csv(f"{params.API_URL}elements/{station}?type=csv")
    elems = elems["description_short"].tolist()
    elems = list(set([x.split("@")[0].strip() for x in elems]))
    elems.append("Reference ET")

    selected = [x for x in selected if x in elems]
    return [{"value": x, "label": x} for x in sorted(elems)], selected


@app.callback(
    Output("temp-derived-data", "data"),
    [
        Input("station-dropdown-derived", "value"),
        Input("derived-vars", "value"),
        Input("start-date-derived", "value"),
        Input("end-date-derived", "value"),
        Input("derived-timeagg", "value"),
        Input("gdd-selection", "value"),
    ],
)
def get_derived_data(station: str, variable, start, end, time, crop):
    if not station or variable == "":
        return None

    if ctx.triggered_id == "gdd-selection":
        slider = [None, None]

    if ctx.triggered_id == "gdd-slider":
        crop = None

    if "soil" in variable or "swp" in variable or "percent_saturation" in variable:
        dat = get.get_derived(station, variable, start, end, time)
        dat2 = get.get_derived(station, "percent_saturation,swp", start, end, time)
        dat = dat.merge(dat2)
    else:
        dat = get.get_derived(station, variable, start, end, time, crop)
    dat = dat.to_json(date_format="iso", orient="records")
    return dat


@app.callback(
    Output("gdd-slider", "value", allow_duplicate=True),
    Output("gdd-selection", "value"),
    Output("derived-timeagg", "value"),
    Output("derived-soil-var", "value", allow_duplicate=True),
    Input("derived-vars", "value"),
    prevent_initial_call=True,
)
def reset_derived_selectors_on_var_update(variable):
    return [50, 86], "wheat", "daily", "soil_vwc"


@app.callback(
    Output("livestock-container", "style"),
    Input("derived-vars", "value"),
)
def hide_livestock_type(variable):
    if variable != "cci":
        return {"display": "None"}
    return {}


@app.callback(
    Output("derived-gdd-panel", "style"),
    Output("derived-soil-panel", "style"),
    Output("derived-timeagg-panel", "style"),
    Output("derived-annual-panel", "style"),
    Input("derived-vars", "value"),
)
def unhide_selected_panel(variable):
    if variable in ["etr", "feels_like", "cci", "swp", "percent_saturation"]:
        return {"display": "None"}, {"display": "None"}, {}, {"display": "None"}
    elif variable == "gdd":
        return {}, {"display": "None"}, {"display": "None"}, {"display": "None"},
    elif variable == "":
        return {"display": "None"}, {"display": "None"}, {"display": "None"}, {},
    else:
        return {"display": "None"}, {}, {"display": "None"}, {"display": "None"},


@app.callback(
    Output("derived-link", "href"),
    Input("derived-vars", "value"),
    Input("gdd-selection", "value"),
)
def update_derived_learn_link(variable, crop):
    base = "https://climate.umt.edu/mesonet/ag_tools/"
    mapper = {"gdd": "gdds", "soil_temp,soil_ec_blk": "soil_profile", "cci": "risk"}

    variable = mapper.get(variable, variable)
    url = f"{base}{variable}/"
    if variable == "gdds":
        url = f"{url}#{crop}-growing-degree-days"
    return url


@app.callback(
    Output("gdd-slider", "value", allow_duplicate=True),
    Input("gdd-selection", "value"),
    prevent_initial_call=True,
)
def update_gdd_slider(sel):
    mapper = {
        "canola": [41, 100],
        "corn": [50, 86],
        "sunflower": [44, 100],
        "wheat": [32, 95],
        "barley": [32, 95],
        "sugarbeet": [34, 86],
        "hemp": [34, 100],
    }
    if sel is None:
        return no_update
    return mapper[sel]


@app.callback(Output("derived-right-panel", "children"), Input("derived-vars", "value"))
def update_derived_control_panel(variable):
    if variable == "gdd":
        return lay.build_gdd_selector()
    else:
        return []


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
        x = re.sub(r"[\(\[].*?[\)\]]", "", x).strip()
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
@tracker.pause_update
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
        config = get.get_station_config(station.station.values[0])
        config["elements"] = config["elements"].replace(params.short_to_long_map)
        return plt.plot_site(
            *select_vars,
            dat=data,
            config=config,
            station=station,
            norm=(len(norm) == 1) and (period == "daily"),
            top_of_hour=period != "raw",
            period=period,
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


@app.callback(
    Output("station-dropdown", "value"),
    Input("url", "pathname"),
    State("mesonet-stations", "data"),
)
@tracker.pause_update
def update_dropdown_from_url(pth, stations):
    stem = Path(pth).stem

    stations = pd.read_json(stations, orient="records")
    out = stations[stations["station"] == stem]
    if len(out) == 0:
        out = stations[stations["nwsli_id"] == stem]

    if stem == "/" or "dash" in stem or len(out) == 0:
        return None
    return out["station"].values[0]


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
@tracker.pause_update
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
            
            [x for x in data.columns if "Wind" in x]
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
        url = f"https://forecast.weather.gov/MapClick.php?lon={row['longitude'].values[0]}&lat={row['latitude'].values[0]}"
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
                x.replace(" Morning", "T09:00:00").replace(" Afternoon", "T15:00:00")
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
                    ),
                    style={
                        "display": "flex",
                        "justify-content": "center",
                        "align-items": "center",
                    },
                ),
            ]
        )


@app.callback(Output("gridmet-switch", "options"), Input("hourly-switch", "value"))
@tracker.pause_update
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
@tracker.pause_update
def toggle_main_tab(sel, stations):
    stations = pd.read_json(stations, orient="records")

    if sel == "station-tab":
        station_fig = make_station_iframe()
        return lay.build_latest_content(station_fig=station_fig, stations=stations)
    elif sel == "satellite-tab":
        return lay.build_satellite_content(stations)
    elif sel == "derived-tab":
        return lay.build_derived_content(stations)
    elif sel == "download-tab":
        station_fig = plt.plot_station(stations, zoom=5)
        station = stations["station"].values[0]
        station_elements = get.get_station_elements(station)
        return lay.build_downloader_content(
            station_fig, elements=station_elements, stations=stations, station=station
        )
    else:
        station_fig = make_station_iframe()
        return lay.build_latest_content(station_fig=station_fig, stations=stations)


@app.callback(
    Output("main-display-tabs", "value"),
    Input("url", "hash"),
    State("main-display-tabs", "value"),
)
def change_display_tab_with_hash(hash, cur):
    if hash == "":
        return cur
    if hash == "#satellite":
        return "satellite-tab"
    elif hash == "#ag":
        return "derived-tab"
    elif hash == "#downloader":
        return "download-tab"
    else:
        return "station-tab"


@app.callback(
    Output("station-dropdown", "options"),
    Input("network-options", "value"),
    State("mesonet-stations", "data"),
)
@tracker.pause_update
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
@tracker.pause_update
def update_sat_selectors(sel, stations, station):
    if sel == "timeseries":
        graph = dcc.Loading(dcc.Graph(id="satellite-plot"))
    else:
        graph = dcc.Loading(dcc.Graph(id="satellite-compare"))
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
    Output("derived-plot", "figure"),
    [
        Input("temp-derived-data", "data"),
        Input("station-dropdown-derived", "value"),
        Input("derived-vars", "value"),
        Input("derived-soil-var", "value"),
        Input("livestock-type", "value"),
        Input("annual-dropdown", "value"),
    ],
    prevent_initial_callback=True,
)
def render_derived_plot(data, station, select_vars, soil_var, livestock_type, annual_var):
    # For some reason I get a syntax error if this isn't here...
    from mdb.utils import plotting as plt

    if station is None:
        return plt.make_nodata_figure(
            """
        <b>Select Station</b> <br><br>
        
        To get started, select a station from the dropdown.
        """
        )
    

    if select_vars == "":
        if annual_var is None:
            return plt.make_nodata_figure("Select a variable for comparison...")
        
        data = get.get_station_record(
            station,
            start_time=dt.date(2000, 1, 1),
            end_time=dt.date.today(),
            period="daily",
            e=annual_var,
            has_etr=False,
            na_info=False,
        )
        colname = [x for x in data.columns if x not in ["datetime", "station"]][0]
        return plt.plot_annual(data, colname)

    
    if len(select_vars) == 0:
        return plt.make_nodata_figure("No variables selected")
    elif data and data != -1:
        data = pd.read_json(data, orient="records")
        data["datetime"] = pd.to_datetime(data["datetime"], utc=True).dt.tz_convert(
            "America/Denver"
        )

    plt = plt_der.plot_derived(data, select_vars, soil_var, livestock_type == "newborn")
    return plt


@app.callback(
    Output("compare1", "options"), Input("station-dropdown-satellite", "value")
)
@tracker.pause_update
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
    State("mesonet-stations", "data"),
)
@tracker.pause_update
def update_downloader_elements(station, public, elements, stations):
    if station is None:
        return [], []

    stations = pd.read_json(stations, orient="records")

    elems_out = get.get_station_elements(station, public)
    derived_elems = [
        {"value": "feels_like", "label": "Feels Like Temperature"},
        {"value": "etr", "label": "Reference ET"},
        {"value": "cci", "label": "Livestock Risk Index"},
    ]

    # if stations[stations['station'] == station].has_swp.values[0]:
    #     derived_elems.append(
    #         {
    #             "value": "swp",
    #             "label": "Soil Water Potential"
    #         }
    #     )
    elems_out.insert(
        0, {"value": "nuffin", "label": "STANDARD ELEMENTS", "disabled": True}
    )
    elems_out.append(
        {"value": "nuffin2", "label": "DERIVED VARIABLES", "disabled": True}
    )
    elems_out += derived_elems

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
@tracker.pause_update
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
    State("dl-rmna", "checked"),
    prevent_initial_call=True,
)
def downloader_data(n_clicks, station, elements, start, end, period, rmna):
    if n_clicks and (not station or not elements):
        return no_update, False, False
    if start is None or station is None:
        return no_update, no_update, True

    start = dt.datetime.strptime(start, "%Y-%m-%d").date()
    end = dt.datetime.strptime(end, "%Y-%m-%d").date()

    std_elems = [
        x
        for x in elements
        if x not in ["feels_like", "etr", "swp", "percent_saturation", "cci"]
    ]
    derived_elems = [
        x
        for x in elements
        if x in ["feels_like", "etr", "swp", "percent_saturation", "cci"]
    ]

    if n_clicks:
        data = get.get_station_record(
            station,
            start,
            end,
            period,
            ",".join(std_elems),
            has_etr=False,
            na_info=True,
            public=False,
            rmna=not rmna,
            derived_elems=derived_elems,
        )
        data = data.rename(columns={"has_na": "Contains Missing Data"})
        if "bp_logger_0244" not in std_elems:
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
@tracker.pause_update
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


@app.callback(
    Output("download-map", "figure"),
    Input("dl-plots", "figure"),
    State("mesonet-stations", "data"),
)
def update_dl_map(plots, stations):
    if tracker.locked:
        stations = pd.read_json(stations, orient="records")
        return plt.plot_station(stations=stations)
    return no_update


@app.callback(
    Output("derived-soil-var", "children"),
    Input("station-dropdown-derived", "value"),
    State("mesonet-stations", "data"),
    State("derived-soil-var", "children"),
)
def update_swp_chips(station, stations, cur):
    if station is None:
        return cur
    stations = pd.read_json(stations, orient="records")
    children = [
        dmc.Chip(v, value=k, size="xs")
        for k, v in [
            ("soil_blk_ec", "Electrical Conductivity"),
            ("soil_vwc", "Volumetric Water Content"),
            ("soil_temp", "Temperature"),
        ]
    ]

    if stations[stations["station"] == station]["has_swp"].values[0]:
        children.append(dmc.Chip("Soil Water Potential", value="swp", size="xs"))
        children.append(
            dmc.Chip("Percent Saturation", value="percent_saturation", size="xs")
        )
    return children


@app.callback(
    Output("derived-soil-var", "value", allow_duplicate=True),
    Input("station-dropdown-derived", "value"),
    State("derived-soil-var", "value"),
    State("mesonet-stations", "data"),
    prevent_initial_call=True,
)
def update_swp_if_station_doesnt_have(station, cur, stations):
    if station is None:
        return "soil_vwc"
    stations = pd.read_json(stations, orient="records")
    has_swp = stations[stations["station"] == station]["has_swp"].values[0]

    if cur in ["swp", "percent_saturation"] and has_swp:
        return cur
    if cur in ["swp", "percent_saturation"] and not has_swp:
        return "soil_vwc"
    return cur


@app.callback(
    Output("station-dropdown-derived", "data"),
    Output("station-dropdown-derived", "value"),
    Input("derived-vars", "value"),
    State("mesonet-stations", "data"),
    State("station-dropdown-derived", "value"),
)
def filter_to_only_swp_stations(variable, stations, cur_station):
    stations = pd.read_json(stations, orient="records")
    if variable in ["swp", "percent_saturation"]:
        stations = stations[stations["has_swp"]]

    data = [
        {"label": k, "value": v}
        for k, v in zip(stations["long_name"], stations["station"])
    ]

    if cur_station is not None and cur_station not in stations["station"].values:
        return data, None
    return data, cur_station


@app.callback(
    Output("annual-dropdown", "data"),
    Output("annual-dropdown", "value"),
    Input("station-dropdown-derived", "value"),
    State("annual-dropdown", "value"),
    prevent_initial_call=True,
)
def update_annual_station_elements(station, cur_val):
    if station is None:
        return [], None
    elements = get.get_station_elements(station, False)

    matched = [x for x in elements if x["value"] == cur_val]
    if len(matched) != 0:
        head = matched[0]['value']
    else:
        head = elements[0]['value']
    return elements, head

@app.callback(
    Output("hourly-switch", "value"),
    Output("dates", "start_date"),
    Output("por-button", "children"),
    Input("por-button", "n_clicks"),
    State("station-dropdown", "value"),
    State("mesonet-stations", "data"),
)
def set_dates_to_por(n_clicks, station, stations):
    if not n_clicks:
        return no_update, no_update, no_update

    if n_clicks % 2 == 1:
        # Odd clicks - show full period of record
        stations = pd.read_json(stations, orient="records")
        d = stations[stations["station"] == station]["date_installed"].values[0]
        return (
            "daily",
            dt.datetime.strptime(d, "%Y-%m-%d").date(),
            "Display Latest 2 Weeks",
        )
    else:
        # Even clicks - show last 2 weeks
        today = dt.date.today()
        two_weeks_ago = today - dt.timedelta(days=14)
        return "hourly", two_weeks_ago, "Display Period of Record"


# def generate_funding_info(req_funding, current_funding, station_name):

#     return [
#         dbc.ModalHeader(dbc.ModalTitle("Support Your Local Mesonet Station")),
#         dbc.ModalBody(
#             dcc.Markdown(
#                 f"""
# **It costs ${req_funding:,} annually to operate and maintain the {station_name} mesonet station. However, only ${current_funding:,} 
# in funding has been secured for this year.** Your support helps ensure that this station remains operational and monitoring continues.
# Please consider supporting this station to preserve Montana's agricultural infrastructure and community safety. Please
# visit the [Montana Mesonet Funding Page](https://climate.umt.edu/mesonet/funding_draft/) or our [Support Us](https://climate.umt.edu/about/support/)
# page to learn more about how you can help.

# Accurate, localized weather and water data are essential—for protecting livelihoods,
# supporting agricultural decision-making, and predicting and preparing for extreme events
# such as drought, floods and fire.
# """
#             )
#         ),
#     ]

# @app.callback(
#     Output("no-funding-modal", "is_open", allow_duplicate=True),
#     Output("no-funding-modal", "children", allow_duplicate=True),
#     Input("station-dropdown", "value"),
#     State("mesonet-stations", "data"),
#     prevent_initial_callback=True,
# )
# def open_no_funding_modal(station, stations):
#     if station is None:
#         return no_update
#     dat = pd.read_csv(f"https://mesonet.climate.umt.edu/api/v2/stations/funding/?stations={station}&type=csv")
#     stations = pd.read_json(stations, orient="records")
#     sub_network = stations[stations['station'] == station].sub_network.values[0]
#     station_name = stations[stations['station'] == station].name.values[0]

#     req_funding = 2500 if sub_network == "AgriMet" else 14000
#     actual_funding = dat[dat['station_code'] == station].funding_amount.values[0]
    
#     if req_funding > actual_funding:
#         return True, generate_funding_info(req_funding, actual_funding, station_name)
#     return False, []

# @app.callback(
#     Output("no-funding-modal", "is_open", allow_duplicate=True),
#     Input("station-dropdown-derived", "value"),
#     State("mesonet-stations", "data"),
#     prevent_initial_callback=True,
# )
# def open_no_funding_modal_derived(station, stations):
#     if station is None:
#         return no_update
#     stations = pd.read_json(stations, orient="records")
#     try:
#         funded = stations[stations['station'] == station].funded.values[0]
#     except AttributeError:
#         return False

#     return not funded

# @app.callback(
#     Output("no-funding-modal", "is_open", allow_duplicate=True),
#     Input("station-dropdown-satellite", "value"),
#     State("mesonet-stations", "data"),
#     prevent_initial_callback=True,
# )
# def open_no_funding_modal_satellite(station, stations):
#     if station is None:
#         return no_update
#     stations = pd.read_json(stations, orient="records")
#     try:
#         funded = stations[stations['station'] == station].funded.values[0]
#     except AttributeError:
#         return False

#     return not funded

# @app.callback(
#     Output("no-funding-modal", "is_open", allow_duplicate=True),
#     Input("station-dropdown-dl", "value"),
#     State("mesonet-stations", "data"),
#     prevent_initial_callback=True,
# )
# def open_no_funding_modal_dl(station, stations):
#     if station is None:
#         return no_update
#     stations = pd.read_json(stations, orient="records")
#     try:
#         funded = stations[stations['station'] == station].funded.values[0]
#     except AttributeError:
#         return False

#     return not funded

if __name__ == "__main__":
    app.run(debug=True)
