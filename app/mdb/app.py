"""
Montana Mesonet Dashboard - Main Application Module

This module contains the main Dash application for the Montana Mesonet Dashboard,
a comprehensive web interface for visualizing and analyzing meteorological data
from the Montana Mesonet weather station network.

The application provides:
- Interactive time series plots of meteorological variables
- Station maps and metadata displays
- Satellite-derived environmental indicators
- Agricultural metrics and derived variables
- Data download capabilities
- State sharing and URL-based configuration

Key Components:
- Dash app configuration and server setup
- FileShare class for state persistence
- Comprehensive callback functions for interactivity
- Multi-tab interface with station, satellite, and derived data views

The dashboard supports multiple data visualization modes, real-time data updates,
and responsive design for various screen sizes.
"""

import datetime as dt
import json
import os
import re
from itertools import chain, cycle
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.error import HTTPError
from urllib.parse import parse_qs

import dash_bootstrap_components as dbc
import dash_loading_spinners as dls
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


def make_station_iframe(station: str = "none") -> html.Div:
    """
    Create an embedded iframe displaying the Montana Mesonet station map.

    Generates an HTML div containing an iframe that loads the interactive
    station map from the Montana Mesonet API, with optional station highlighting.

    Args:
        station (str): Station identifier to highlight on the map.
            Defaults to "none" for no highlighting.

    Returns:
        html.Div: Dash HTML div containing the embedded map iframe.

    Note:
        The iframe loads the station map from the Montana Mesonet API
        and applies the "second-row" CSS class for styling.
    """
    return html.Div(
        html.Iframe(
            src=f"https://mesonet.climate.umt.edu/api/map/stations/?station={station}"
        ),
        className="second-row",
    )


def parse_query_string(query_string: str) -> Dict[str, str]:
    """
    Parse URL query string parameters into a dictionary.

    Extracts key-value pairs from URL query strings, taking the first
    value for each parameter key. Used for processing shared state URLs.

    Args:
        query_string (str): URL query string (with or without leading '?').

    Returns:
        Dict[str, str]: Dictionary mapping parameter names to their first values.

    Example:
        >>> parse_query_string("?state=abc123&tab=station")
        {'state': 'abc123', 'tab': 'station'}
    """
    query_string = query_string.replace("?", "")
    parsed_data = parse_qs(query_string)
    result_dict = {key: value[0] for key, value in parsed_data.items()}
    return result_dict


class FileShare(DashShare):
    """
    File-based implementation of dashboard state sharing.

    Provides persistent storage of dashboard configurations using JSON files
    in a local 'share' directory. Enables users to save and share specific
    dashboard states via URL parameters.

    Inherits from DashShare and implements the abstract save/load methods
    for file-based state persistence.
    """

    def load(self, input: str, state: Any) -> Any:
        """
        Load a previously saved dashboard state from file.

        Parses the URL query string to extract state identifiers and
        loads the corresponding JSON configuration file.

        Args:
            input (str): URL query string containing state parameter.
            state (Any): Current dashboard state (fallback if load fails).

        Returns:
            Any: Loaded dashboard state or original state if file not found.

        Note:
            - Automatically closes the save modal after loading
            - Gracefully handles missing state files
            - State files are stored in ./share/ directory
        """
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

    def save(self, input: Optional[int], state: Any, hash: str) -> Optional[int]:
        """
        Save the current dashboard state to a JSON file.

        Persists the dashboard configuration to a file named with the
        provided hash identifier. Clears transient data before saving.

        Args:
            input (Optional[int]): Save trigger value (button clicks).
            state (Any): Current dashboard state to save.
            hash (str): Unique identifier for the saved state file.

        Returns:
            Optional[int]: Original input value (for callback chaining).

        Note:
            - Creates ./share/ directory if it doesn't exist
            - Skips saving if file already exists (prevents overwrites)
            - Clears temporary data and figures before saving
            - Only saves when input indicates user action (> 0)
        """
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
app.layout = lambda: tracker.update_layout(lay.app_layout(app, get.get_sites()))
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
def update_banner_text(station: str, tab: str, stations: str) -> str:
    """
    Update the banner title to include the selected station name.

    Dynamically updates the main dashboard title to show the currently
    selected station when viewing station-specific data.

    Args:
        station (str): Station identifier/short name.
        tab (str): Currently active main tab identifier.
        stations (str): JSON string containing station metadata.

    Returns:
        str: Updated banner title text. Shows station name for station tab,
             otherwise shows default dashboard title.

    Note:
        - Only shows station name when on the "station-tab"
        - Gracefully handles missing stations with default title
        - Uses station's full display name from metadata
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
) -> Tuple[Union[dcc.Graph, dash_table.DataTable, html.Div], str]:
    """
    Update the bottom-left card content based on selected tab.

    Manages the content of the multi-tab card showing station maps,
    metadata, and current conditions. Switches between different
    views based on user selection and data availability.

    Args:
        at (str): Active tab identifier ('map-tab', 'meta-tab', 'data-tab').
        station (str): Selected station short name/identifier.
        tmp_data (Union[int, str]): Station data as JSON string or -1 if no data.
        stations (str): JSON string containing all station metadata.

    Returns:
        Tuple[Union[dcc.Graph, dash_table.DataTable, html.Div], str]:
            - Content component (map iframe, data table, or div)
            - Active tab identifier

    Note:
        - Automatically switches to map tab if no station selected for data tab
        - Shows latest data summary and precipitation summary for HydroMet stations
        - Falls back to metadata tab if data is unavailable
        - Handles missing station data gracefully
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
        try:
            pager = [x for x in params.one_pagers if x["station"] == station]
            pager = pager[0]["url"]
            table.insert(
                2, {"Field": "Station One-Pager", "Value": f"[Click to View]({pager})"}
            )
        except (KeyError, IndexError):
            pager = None
        return dash_table.DataTable(
            data=table,
            columns=[
                {"id": "Field", "name": "Field"},
                {"id": "Value", "name": "Value", "presentation": "markdown"},
            ],
            **lay.TABLE_STYLING,
        ), "meta-tab"
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
def download_called_data(
    n_clicks: Optional[int],
    tmp_data: Optional[str],
    station: str,
    time: str,
    start: str,
    end: str,
) -> Optional[Dict[str, Any]]:
    """
    Handle data download requests from the dashboard.

    Processes user requests to download station data as CSV files,
    generating appropriately named files based on station, time period,
    and date range selections.

    Args:
        n_clicks (Optional[int]): Number of times download button was clicked.
        tmp_data (Optional[str]): JSON string of station data to download.
        station (str): Station identifier for filename.
        time (str): Time aggregation level for filename.
        start (str): Start date string (YYYY-MM-DD format).
        end (str): End date string (YYYY-MM-DD format).

    Returns:
        Optional[Dict[str, Any]]: Download object for Dash, or None if no download.

    Note:
        - Only triggers download when button is clicked and data exists
        - Generates descriptive filenames with station, period, and dates
        - Converts JSON data back to DataFrame for CSV export
    """
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
def update_select_vars(
    station: str, selected: Optional[List[str]]
) -> Tuple[List[Dict[str, str]], List[str]]:
    """
    Update available variable options based on selected station.

    Dynamically updates the variable selection checklist to show only
    variables available at the selected station, while preserving
    user selections where possible.

    Args:
        station (str): Selected station identifier.
        selected (Optional[List[str]]): Currently selected variables.

    Returns:
        Tuple[List[Dict[str, str]], List[str]]:
            - List of option dictionaries with 'value' and 'label' keys
            - List of selected variable names (filtered for availability)

    Note:
        - Uses default variable set when no station is selected
        - Queries station-specific elements from the API
        - Automatically adds Reference ET to all stations
        - Preserves user selections that are available at the new station
        - Decorated with @tracker.pause_update to prevent callback loops
    """
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
def get_derived_data(
    station: str, variable: str, start: str, end: str, time: str, crop: Optional[str]
) -> Optional[str]:
    """
    Retrieve derived agricultural and environmental data for plotting.

    Fetches calculated variables like growing degree days, soil metrics,
    and environmental indices from the Montana Mesonet derived data API.

    Args:
        station (str): Station identifier.
        variable (str): Derived variable type ('gdd', 'etr', 'soil_vwc', etc.).
        start (str): Start date for data retrieval.
        end (str): End date for data retrieval.
        time (str): Temporal aggregation ('daily', 'hourly').
        crop (Optional[str]): Crop type for GDD calculations.

    Returns:
        Optional[str]: JSON string of derived data, or None if no station/variable.

    Note:
        - Handles special cases for soil variables (merges multiple datasets)
        - Supports crop-specific growing degree day calculations
        - Returns data in JSON format for client-side processing
        - Automatically merges soil water potential data for soil variables
    """
    if not station or variable == "":
        return None

    if ctx.triggered_id == "gdd-selection":
        slider = [None, None]  # noqa: F841

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
def reset_derived_selectors_on_var_update(
    variable: str,
) -> Tuple[List[int], str, str, str]:
    """
    Reset derived variable selectors to default values when variable changes.

    Automatically resets related controls (GDD slider, crop selection, etc.)
    to sensible defaults when the user changes the derived variable type.

    Args:
        variable (str): Selected derived variable type.

    Returns:
        Tuple[List[int], str, str, str]:
            - GDD temperature range [base, max]
            - Default crop selection
            - Default time aggregation
            - Default soil variable

    Note:
        - Prevents invalid combinations of settings
        - Uses wheat GDD parameters as default
        - Ensures consistent user experience across variable types
    """
    return [50, 86], "wheat", "daily", "soil_vwc"


@app.callback(
    Output("livestock-container", "style"),
    Input("derived-vars", "value"),
)
def hide_livestock_type(variable: str) -> Dict[str, str]:
    """
    Show or hide the livestock type selector based on selected variable.

    Controls the visibility of livestock type selection (newborn vs mature)
    which is only relevant for the Comprehensive Climate Index (CCI) variable.

    Args:
        variable (str): Selected derived variable type.

    Returns:
        Dict[str, str]: CSS style dictionary to show or hide the container.

    Note:
        - Only shows livestock selector for CCI variable
        - Returns display:None to hide for all other variables
    """
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
def unhide_selected_panel(
    variable: str,
) -> Tuple[Dict[str, str], Dict[str, str], Dict[str, str], Dict[str, str]]:
    """
    Control visibility of derived variable control panels.

    Shows/hides different control panels based on the selected derived variable,
    ensuring only relevant controls are visible for each variable type.

    Args:
        variable (str): Selected derived variable type.

    Returns:
        Tuple[Dict[str, str], Dict[str, str], Dict[str, str], Dict[str, str]]:
            CSS style dictionaries for:
            - GDD panel (temperature thresholds and crop selection)
            - Soil panel (soil variable selection)
            - Time aggregation panel (daily/hourly selection)
            - Annual panel (annual comparison variables)

    Note:
        - GDD variables show only GDD-specific controls
        - Soil variables show only soil-specific controls
        - ETR/feels_like/CCI show only time aggregation
        - Empty selection shows annual comparison panel
    """
    if variable in ["etr", "feels_like", "cci", "swp", "percent_saturation"]:
        return {"display": "None"}, {"display": "None"}, {}, {"display": "None"}
    elif variable == "gdd":
        return (
            {},
            {"display": "None"},
            {"display": "None"},
            {"display": "None"},
        )
    elif variable == "":
        return (
            {"display": "None"},
            {"display": "None"},
            {"display": "None"},
            {},
        )
    else:
        return (
            {"display": "None"},
            {},
            {"display": "None"},
            {"display": "None"},
        )


@app.callback(
    Output("derived-link", "href"),
    Input("derived-vars", "value"),
    Input("gdd-selection", "value"),
)
def update_derived_learn_link(variable: str, crop: Optional[str]) -> str:
    """
    Generate educational links for derived variables.

    Creates URLs to Montana Climate Office educational resources
    explaining the selected derived variable and its applications.

    Args:
        variable (str): Selected derived variable type.
        crop (Optional[str]): Selected crop type for GDD variables.

    Returns:
        str: URL to relevant educational content.

    Note:
        - Links to Montana Climate Office agricultural tools documentation
        - GDD links include crop-specific anchors
        - Provides context and interpretation guidance for users
    """
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
def update_gdd_slider(sel: Optional[str]) -> Union[List[int], Any]:
    """
    Update GDD temperature thresholds based on selected crop.

    Sets appropriate base and maximum temperatures for growing degree
    day calculations based on the selected crop type.

    Args:
        sel (Optional[str]): Selected crop type identifier.

    Returns:
        Union[List[int], Any]: Temperature range [base, max] in Fahrenheit,
            or no_update if no selection.

    Note:
        - Each crop has research-based temperature thresholds
        - Base temperature: minimum for growth
        - Maximum temperature: point where growth plateaus
        - Values based on agricultural research and industry standards
    """
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
def update_derived_control_panel(variable: str) -> List[Any]:
    """
    Update the right panel controls for derived variables.

    Shows variable-specific controls in the right panel, currently
    only used for GDD crop selection interface.

    Args:
        variable (str): Selected derived variable type.

    Returns:
        List[Any]: List of control components, or empty list if none needed.

    Note:
        - GDD variables show crop selection and temperature controls
        - Other variables return empty list (no additional controls)
        - Allows for future expansion of variable-specific controls
    """
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
def get_latest_api_data(
    station: str,
    start: str,
    end: str,
    hourly: str,
    select_vars: List[str],
    tmp: Optional[str],
) -> Optional[str]:
    """
    Retrieve and cache station data from the Montana Mesonet API.

    Intelligently fetches station data, using caching and incremental
    loading to minimize API calls and improve performance. Handles
    different temporal aggregations and variable selections.

    Args:
        station (str): Station identifier.
        start (str): Start date string (YYYY-MM-DD format).
        end (str): End date string (YYYY-MM-DD format).
        hourly (str): Temporal aggregation ('hourly', 'daily', 'raw').
        select_vars (List[str]): List of selected variable names.
        tmp (Optional[str]): Cached data as JSON string, or None.

    Returns:
        Optional[str]: Station data as JSON string, -1 if no data, or None if no station.

    Note:
        - Uses intelligent caching to avoid redundant API calls
        - Automatically adds wind variables for wind rose plots
        - Handles Reference ET as special derived variable
        - Merges new variables with existing cached data when possible
        - Returns -1 when no data is available for the selection
    """
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
def adjust_start_date(station: str, stations: str) -> Optional[dt.date]:
    """
    Set the minimum allowed date based on station installation date.

    Prevents users from selecting dates before the station was installed
    and began collecting data.

    Args:
        station (str): Selected station identifier.
        stations (str): JSON string containing station metadata.

    Returns:
        Optional[dt.date]: Minimum allowed date, or None if no station selected.

    Note:
        - Decorated with @tracker.pause_update to prevent callback loops
        - Uses station installation date as minimum
        - Ensures data requests are within valid ranges
    """
    stations = pd.read_json(stations, orient="records")

    if station:
        d = stations[stations["station"] == station]["date_installed"].values[0]
        return dt.datetime.strptime(d, "%Y-%m-%d").date()


@app.callback(Output("date-button", "disabled"), Input("station-dropdown", "value"))
def enable_date_button(station: Optional[str]) -> bool:
    """
    Enable or disable the period of record button based on station selection.

    The period of record button should only be enabled when a station
    is selected, as it needs station metadata to set appropriate dates.

    Args:
        station (Optional[str]): Selected station identifier.

    Returns:
        bool: True to disable button (no station), False to enable (station selected).

    Note:
        - Button is disabled when no station is selected
        - Prevents errors from trying to access station metadata
    """
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
def render_station_plot(
    tmp_data: Optional[str],
    select_vars: List[str],
    station: str,
    period: str,
    norm: Union[int, List[int]],
    stations: str,
) -> Any:
    """
    Render the main station data visualization plot.

    Creates multi-panel time series plots of selected meteorological
    variables with optional climatological normal overlays and
    sensor change annotations.

    Args:
        tmp_data (Optional[str]): Station data as JSON string, -1 if no data, or None.
        select_vars (List[str]): List of selected variable names to plot.
        station (str): Selected station identifier.
        period (str): Temporal aggregation ('hourly', 'daily', 'raw').
        norm (Union[int, List[int]]): GridMET normals toggle state.
        stations (str): JSON string containing station metadata.

    Returns:
        Any: Plotly figure object with station data visualization.

    Note:
        - Returns informative messages when no data or variables selected
        - Applies timezone conversion to America/Denver
        - Includes sensor change annotations when available
        - Supports climatological normal overlays for daily data
        - Handles multiple variable types with appropriate styling
    """
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
def update_dropdown_from_url(pth: str, stations: str) -> Optional[str]:
    """
    Update station selection based on URL path.

    Enables direct station access via URL paths, supporting both
    station short names and NWSLI IDs for backwards compatibility.

    Args:
        pth (str): URL pathname from browser.
        stations (str): JSON string containing station metadata.

    Returns:
        Optional[str]: Station identifier if found in URL, None otherwise.

    Note:
        - Decorated with @tracker.pause_update to prevent callback loops
        - Supports both station codes and NWSLI IDs
        - Ignores root paths and dashboard-specific paths
        - Enables bookmarkable station-specific URLs
    """
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
def enable_photo_tab(station: str, stations: str) -> List[dbc.Tab]:
    """
    Enable photo tab for HydroMet stations with cameras.

    Dynamically adds the photo tab to the upper-left card when
    a HydroMet station with camera equipment is selected.

    Args:
        station (str): Selected station identifier.
        stations (str): JSON string containing station metadata.

    Returns:
        List[dbc.Tab]: List of tab components, including photo tab if applicable.

    Note:
        - Photo tab only available for HydroMet network stations
        - AgriMet stations don't have camera equipment
        - Gracefully handles missing station data
        - Maintains consistent tab order across station types
    """
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
def select_default_tab(station: str, stations: str) -> str:
    """
    Select the default active tab based on station capabilities.

    Automatically selects the most relevant tab when a station is chosen,
    prioritizing photos for HydroMet stations and wind rose for others.

    Args:
        station (str): Selected station identifier.
        stations (str): JSON string containing station metadata.

    Returns:
        str: Tab identifier for the default active tab.

    Note:
        - HydroMet stations default to photo tab (when available)
        - AgriMet and other stations default to wind rose tab
        - Falls back to wind tab if station data is unavailable
    """
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
def update_ul_card(
    at: str, station: Optional[str], tmp_data: Optional[str], stations: str
) -> Union[html.Div, Tuple[html.Div]]:
    """
    Update the upper-left card content based on selected tab.

    Manages the content of the multi-tab upper-left card, switching between
    wind rose plots, weather forecasts, and station photos based on user
    selection and station capabilities.

    Args:
        at (str): Active tab identifier ('wind-tab', 'wx-tab', 'photo-tab').
        station (Optional[str]): Selected station identifier.
        tmp_data (Optional[str]): Station data as JSON string, -1 if no data, or None.
        stations (str): JSON string containing station metadata.

    Returns:
        Union[html.Div, Tuple[html.Div]]: Content component(s) for the selected tab.

    Note:
        - Decorated with @tracker.pause_update to prevent callback loops
        - Wind tab: Creates wind rose from station data
        - Weather tab: Embeds NWS forecast iframe
        - Photo tab: Creates camera controls and image display
        - Handles missing data gracefully with appropriate messages
        - Photo options vary by camera model and capabilities
    """
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
                    dmc.Container(
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
def disable_gridmet_switch(period: str) -> List[Dict[str, Union[str, int, bool]]]:
    """
    Enable or disable gridMET normals based on temporal aggregation.

    GridMET climate normals are only available for daily data, so the
    toggle is disabled for hourly and raw data selections.

    Args:
        period (str): Selected temporal aggregation ('hourly', 'daily', 'raw').

    Returns:
        List[Dict[str, Union[str, int, bool]]]: Option configuration for the switch.

    Note:
        - Decorated with @tracker.pause_update to prevent callback loops
        - GridMET normals are pre-computed daily climatologies
        - Disabled for sub-daily data where normals aren't applicable
        - Provides user feedback about when normals are available
    """
    if period != "daily":
        return [{"label": "gridMET Normals", "value": 1, "disabled": True}]
    return [{"label": "gridMET Normals", "value": 1, "disabled": False}]


@app.callback(
    Output("photo-figure", "children"),
    [
        Input("station-dropdown", "value"),
        Input("photo-direction", "value"),
        Input("photo-time", "value"),
    ],
)
def update_photo_direction(station: str, direction: str, dt: str) -> Any:
    """
    Update the station photo based on direction and time selection.

    Fetches and displays station camera images based on user-selected
    viewing direction and timestamp.

    Args:
        station (str): Station identifier.
        direction (str): Camera direction ('n', 's', 'e', 'w', etc.).
        dt (str): Timestamp for photo retrieval.

    Returns:
        Any: Plotly figure containing the station photo.

    Note:
        - Supports multiple camera directions depending on station equipment
        - Handles both morning and afternoon photo times
        - Uses Montana Mesonet photo API for image retrieval
        - Returns appropriate figure for display in dashboard
    """
    return dmc.Image(
        radius="md",
        src=f"https://mesonet.climate.umt.edu/api/photos/{station}/{direction.lower()}?dt={dt}&force=True",
    )


@app.callback(
    [Output("station-modal", "children"), Output("station-modal", "is_open")],
    [Input("station-fig", "clickData")],
    [State("station-modal", "is_open")],
)
def station_popup(
    clickData: Optional[Dict], is_open: bool
) -> Tuple[Union[str, dbc.ModalBody], bool]:
    """
    Handle station map click events to show station information popup.

    Creates a modal popup with station details when users click on
    station markers in the map interface.

    Args:
        clickData (Optional[Dict]): Click event data from map interaction.
        is_open (bool): Current modal open state.

    Returns:
        Tuple[Union[str, dbc.ModalBody], bool]:
            - Modal content (station info or empty string)
            - Updated modal open state

    Note:
        - Extracts station metadata from map click events
        - Formats station information in markdown
        - Toggles modal visibility on click
        - Provides quick access to station details and dashboard links
    """
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
def toggle_modal(n1: Optional[int], is_open: bool) -> bool:
    """
    Toggle the help/information modal dialog.

    Controls the visibility of the main help modal containing
    dashboard information and usage instructions.

    Args:
        n1 (Optional[int]): Number of times help button was clicked.
        is_open (bool): Current modal open state.

    Returns:
        bool: Updated modal open state.

    Note:
        - Toggles modal visibility when help button is clicked
        - Returns current state if no button interaction
    """
    if n1:
        return not is_open
    return is_open


@app.callback(
    Output("feedback-modal", "is_open"),
    [Input("feedback-button", "n_clicks")],
    [State("feedback-modal", "is_open")],
)
def toggle_feedback(n1: Optional[int], is_open: bool) -> bool:
    """
    Toggle the feedback modal dialog.

    Controls the visibility of the feedback modal containing
    the embedded feedback form for user submissions.

    Args:
        n1 (Optional[int]): Number of times feedback button was clicked.
        is_open (bool): Current modal open state.

    Returns:
        bool: Updated modal open state.

    Note:
        - Toggles modal visibility when feedback button is clicked
        - Returns current state if no button interaction
    """
    if n1:
        return not is_open
    return is_open


@app.callback(
    Output("main-content", "children"),
    Input("main-display-tabs", "value"),
    State("mesonet-stations", "data"),
)
@tracker.pause_update
def toggle_main_tab(sel: str, stations: str) -> List[Any]:
    """
    Switch main dashboard content based on selected tab.

    Controls the primary dashboard view, switching between station data,
    satellite indicators, derived variables, and data download interfaces.

    Args:
        sel (str): Selected main tab identifier.
        stations (str): JSON string containing station metadata.

    Returns:
        List[Any]: Layout components for the selected tab content.

    Note:
        - Decorated with @tracker.pause_update to prevent callback loops
        - Station tab: Latest data with interactive plots and maps
        - Satellite tab: Remote sensing indicators and comparisons
        - Derived tab: Agricultural metrics and environmental indices
        - Download tab: Data export interface with station selection
        - Falls back to station tab for unknown selections
    """
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
def change_display_tab_with_hash(hash: str, cur: str) -> str:
    """
    Update active tab based on URL hash fragment.

    Enables direct linking to specific dashboard sections using
    URL hash fragments for bookmarking and sharing.

    Args:
        hash (str): URL hash fragment (e.g., '#satellite').
        cur (str): Current active tab identifier.

    Returns:
        str: Updated tab identifier based on hash.

    Note:
        - #satellite -> satellite-tab (remote sensing data)
        - #ag -> derived-tab (agricultural variables)
        - #downloader -> download-tab (data export)
        - Empty hash preserves current tab
        - Unknown hashes default to station-tab
    """
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
def subset_stations(opts: List[str], stations: str) -> List[Dict[str, str]]:
    """
    Filter station dropdown options based on network selection.

    Updates the station dropdown to show only stations from selected
    networks (HydroMet, AgriMet, or both).

    Args:
        opts (List[str]): List of selected network names.
        stations (str): JSON string containing station metadata.

    Returns:
        List[Dict[str, str]]: Filtered station options for dropdown.

    Note:
        - Decorated with @tracker.pause_update to prevent callback loops
        - Empty selection shows all stations
        - Supports multiple network selection
        - Uses regex matching for network filtering
        - Maintains consistent option format for dropdowns
    """
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
def update_sat_selectors(
    sel: str, stations: str, station: Optional[str]
) -> Tuple[Any, Any]:
    """
    Update satellite data interface based on visualization mode.

    Switches between time series and comparison modes for satellite data,
    updating both the control selectors and the graph container.

    Args:
        sel (str): Selected visualization mode ('timeseries' or 'comparison').
        stations (str): JSON string containing station metadata.
        station (Optional[str]): Currently selected station.

    Returns:
        Tuple[Any, Any]:
            - Selector components for the chosen mode
            - Graph container with appropriate loading spinner

    Note:
        - Decorated with @tracker.pause_update to prevent callback loops
        - Timeseries mode: Multi-variable time series with climatology
        - Comparison mode: Scatter plots between two variables
        - Updates both controls and graph containers dynamically
    """
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
def render_satellite_ts_plot(
    station: Optional[str], elements: List[str], climatology: bool
) -> Any:
    """
    Render satellite indicator time series plots.

    Creates multi-panel time series visualizations of satellite-derived
    environmental indicators with optional climatological context.

    Args:
        station (Optional[str]): Selected station identifier.
        elements (List[str]): List of selected satellite indicators.
        climatology (bool): Whether to include climatological normal bands.

    Returns:
        Any: Plotly figure with satellite time series or informative message.

    Note:
        - Fetches data from 2000 to present for climatological context
        - Supports multiple indicators in subplot format
        - Includes climatological percentile bands when requested
        - Returns helpful messages when no station or indicators selected
        - Uses satellite data from Neo4j database
    """
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
def render_derived_plot(
    data: Optional[str],
    station: Optional[str],
    select_vars: str,
    soil_var: str,
    livestock_type: str,
    annual_var: Optional[str],
) -> Any:
    """
    Render derived agricultural and environmental variable plots.

    Creates specialized visualizations for derived metrics including
    growing degree days, soil profiles, livestock comfort indices,
    and annual comparison plots.

    Args:
        data (Optional[str]): Derived data as JSON string.
        station (Optional[str]): Selected station identifier.
        select_vars (str): Selected derived variable type.
        soil_var (str): Selected soil variable for soil plots.
        livestock_type (str): Livestock type for CCI calculations.
        annual_var (Optional[str]): Variable for annual comparison plots.

    Returns:
        Any: Plotly figure with derived variable visualization.

    Note:
        - Handles multiple derived variable types with specialized plots
        - Annual comparison mode shows multi-year overlays
        - Soil variables include depth profile visualizations
        - CCI plots support different livestock categories
        - Applies timezone conversion for temporal data
        - Returns informative messages for missing selections
    """
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
        {"value": "nuffin", "label": "DERIVED VARIABLES", "disabled": True}
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
        head = matched[0]["value"]
    else:
        head = elements[0]["value"]
    return elements, head


@app.callback(
    Output("hourly-switch", "value"),
    Output("dates", "start_date"),
    Output("por-button", "children"),
    Input("por-button", "n_clicks"),
    State("station-dropdown", "value"),
    State("mesonet-stations", "data"),
)
def set_dates_to_por(
    n_clicks: Optional[int], station: str, stations: str
) -> Tuple[Union[str, Any], Union[dt.date, Any], Union[str, Any]]:
    """
    Toggle between period of record and recent data views.

    Alternates between showing the full station record (daily data)
    and the most recent 2 weeks (hourly data) with each button click.

    Args:
        n_clicks (Optional[int]): Number of times the button was clicked.
        station (str): Selected station identifier.
        stations (str): JSON string containing station metadata.

    Returns:
        Tuple[Union[str, Any], Union[dt.date, Any], Union[str, Any]]:
            - Time aggregation setting ('daily' or 'hourly')
            - Start date (installation date or 2 weeks ago)
            - Updated button text

    Note:
        - Odd clicks: Show full period of record with daily data
        - Even clicks: Show recent 2 weeks with hourly data
        - Automatically adjusts time aggregation for optimal performance
        - Updates button text to indicate next action
    """
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
    app.run_server(debug=True)
