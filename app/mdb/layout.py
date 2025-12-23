"""
Layout Components for Montana Mesonet Dashboard

This module defines the user interface layout components for the Montana Mesonet
Dashboard. It provides functions to build various UI elements including navigation,
cards, forms, and content areas using Dash Bootstrap Components and Dash Mantine.

Key Components:
- Banner and navigation elements
- Multi-tab content areas for different data views
- Form controls for data selection and filtering
- Modal dialogs for help and feedback
- Responsive layout containers for different screen sizes

The module emphasizes responsive design, accessibility, and consistent styling
throughout the dashboard interface.
"""

import datetime as dt
from typing import Any, List, Optional

import dash_bootstrap_components as dbc
import dash_loading_spinners as dls
import dash_mantine_components as dmc
import pandas as pd
from dash import dcc, html
from dash_iconify import DashIconify
from dateutil.relativedelta import relativedelta as rd

TABLE_STYLING = {
    "css": [{"selector": "tr:first-child", "rule": "display: none"}],
    "style_cell": {"textAlign": "left"},
    "style_data": {"color": "black", "backgroundColor": "white"},
    "style_data_conditional": [
        {"if": {"row_index": "odd"}, "backgroundColor": "rgb(220, 220, 220)"},
        {
            "if": {"column_id": "Value"},
            "textDecoration": "none",
            "color": "inherit",
        },
    ],
}

TAB_STYLE = {
    "width": "inherit",
    "borderTop": "1px black solid",
    # 'borderBottom': '1px black solid',
    "background": "white",
    "paddingTop": 0,
    "paddingBottom": 0,
    # 'height': '100px',
    "line-height": "4.5vh",
}

SELECTED_STYLE = {
    "width": "inherit",
    # "boxShadow": "none",
    "borderTop": "3px #0B5ED7 solid",
    # 'borderBottom': '1px black solid',
    "boxShadow": "inset 0px -1px 0px 0px lightgrey",
    "background": "#E9ECEF",
    "paddingTop": 0,
    "paddingBottom": 0,
    # 'height': '42px',
    "line-height": "4.5vh",
}


def generate_modal() -> html.Div:
    """
    Generate the help/information modal dialog.

    Creates a modal dialog containing comprehensive information about the
    Montana Mesonet Dashboard, including usage instructions, background
    information, and contact details.

    Returns:
        html.Div: Modal dialog component with dashboard information.

    Note:
        - Contains markdown-formatted content with links
        - Includes usage instructions and contact information
        - Provides background on the Montana Mesonet network
        - Links to external resources and documentation
    """
    return html.Div(
        dbc.Modal(
            [
                dbc.ModalHeader(dbc.ModalTitle("")),
                dbc.ModalBody(
                    dcc.Markdown(
                        """
                        #### The Montana Mesonet Dashboard
                        Welcome to the Montana Mesonet Dashboard! This dashboard visualizes historical data from all stations that are a part of the Montana Mesonet. 
                        To visualize data from a station, either select a station from the dropdown on the top left, click a station on the locator map, or add a station name to the URL path (e.g. [https://mesonet.climate.umt.edu/dash/crowagen](https://mesonet.climate.umt.edu/dash/crowagen)).
                        The station data is aggregated on demand from the [Montana Mesonet API](https://mesonet.climate.umt.edu/api/v2/docs).
                        
                        The "Satellite Indicators" tab uses data from NASA satellites to provide timeseries of relevant indicators at all Mesonet stations. 
                        To display data on this tab, select a station from the dropdown on the left. Selecting the "Timeseries" button shows a timeseries of a given variable for the current year, with previous years plotted as grey lines in the background for context.
                        Selecting the "Comparison" button allows you to choose two variable to plot against one another for the current year. 
                        If you encounter any bugs, would like to request a new feature, or have a question regarding the dashboard, please:
                        - Email [james.seielstad@mso.umt.edu](mailto:james.seielstad@mso.umt.edu),
                        - Fill out our [feedback form](https://airtable.com/appUacO5Pq7wZYoJ3/pagqtNp2dSSjhkUkN/form),
                        - Or open an issue on [our GitHub](https://github.com/mt-climate-office/mesonet-dashboard/issues).      

                        For questions or issues related to current Mesonet stations, please contact our Mesonet Manager (Kevin Hyde) at
                        [kevin.hyde@umontana.edu](mailto:kevin.hyde@umontana.edu). For general questions about the Mesonet and its development,
                        please contact the state climatologist (Kelsey Jencso) at [kelsey.jencso@umontana.edu](mailto:kelsey.jencso@umontana.edu).

                        #### Montana Mesonet Background
                        The Montana Climate Office (MCO) installed 6 weather and soil moisture monitoring stations in 2016 as part of the Montana Research 
                        and Economic Development Initiative (MREDI). The Mesonet was designed to support decision-making for statewide drought assessments, 
                        precision agriculture and rangeland and forested watershed management. Since 2016 the network has grown to 94 stations through support
                        from private landowners, watershed groups, tribes, state agencies and grants from federal entities. In 2020 the MCO was awarded a contract 
                        from the U.S. Army Corps to add 205 additional stations. The new stations will be installed every 500 square miles in central and eastern
                        Montana to improve drought assessments and flood forecasting - in the protection of lives and property.
                        #### Source Code
                        See how we built this application at our [GitHub repository](https://github.com/mt-climate-office/mesonet-dashboard/tree/main).
                    """
                    )
                ),
            ],
            id="modal",
            is_open=False,
            size="xl",
            scrollable=True,
        )
    )


def feedback_iframe() -> html.Div:
    """
    Generate the feedback modal dialog with embedded form.

    Creates a modal dialog containing an embedded Airtable feedback form
    for users to submit bug reports, feature requests, and general feedback.

    Returns:
        html.Div: Modal dialog component with embedded feedback form.

    Note:
        - Embeds external Airtable form for feedback collection
        - Uses full-height modal for better form visibility
        - Includes appropriate styling for iframe integration
        - Provides scrollable content for longer forms
    """
    return html.Div(
        dbc.Modal(
            [
                dbc.ModalHeader(
                    dbc.ModalTitle("Provide Feedback to Improve Our Dashboard")
                ),
                dbc.ModalBody(
                    html.Iframe(
                        src="https://airtable.com/embed/appUacO5Pq7wZYoJ3/pagqtNp2dSSjhkUkN/form",
                        style={
                            "backgroundColor": "orange",
                            "frameborder": "0",
                            "onmousewheel": "",
                            "width": "100%",
                            "height": "90vh",
                            "background": "transparent",
                            "border": "2px solid #ccc",
                        },
                    ),
                    style={"overflow": "clip"},
                ),
            ],
            id="feedback-modal",
            is_open=False,
            size="xl",
            scrollable=True,
            style={"max-height": "none", "height": "100%"},
        )
    )


def build_banner(app_ref: Any) -> dbc.Navbar:
    """
    Build the main navigation banner for the dashboard.

    Creates the top navigation bar containing the Montana Climate Office logo,
    dashboard title, and action buttons for feedback, help, and sharing.

    Args:
        app_ref (Any): Dash application reference for asset URL generation.

    Returns:
        dbc.Navbar: Bootstrap navbar component with logo, title, and buttons.

    Note:
        - Logo links to Montana Climate Office website
        - Title is dynamically updated based on selected station
        - Includes buttons for user feedback, help, and plot sharing
        - Uses responsive design for different screen sizes
    """
    return dbc.Navbar(
        dbc.Container(
            [
                html.A(
                    # Use row and col to control vertical alignment of logo / brand
                    dbc.Row(
                        [
                            dbc.Col(
                                html.A(
                                    href="https://climate.umt.edu/",
                                    children=[
                                        html.Img(
                                            id="pls-work",
                                            src=app_ref.get_asset_url("MCO_logo.svg"),
                                            height="50px",
                                            alt="MCO Logo",
                                        )
                                    ],
                                )
                            ),
                            # dbc.Col(
                            #     dbc.NavbarBrand(
                            #         "Montana Mesonet Dashboard", className="ms-5"
                            #     )
                            # ),
                        ],
                        align="center",
                        className="g-0",
                    ),
                    style={"textDecoration": "none"},
                ),
                html.Div(
                    html.P(
                        "The Montana Mesonet Dashboard",
                        id="banner-title",
                        className="bannertxt",
                    )
                ),
                html.Div(
                    [
                        dbc.Button(
                            "GIVE FEEDBACK",
                            href="https://airtable.com/appUacO5Pq7wZYoJ3/pagqtNp2dSSjhkUkN/form",
                            size="lg",
                            n_clicks=0,
                            id="feedback-button",
                            className="me-md-2",
                            target="_blank",
                        ),
                        dbc.Button(
                            "LEARN MORE",
                            href="#",
                            size="lg",
                            n_clicks=0,
                            id="help-button",
                            className="me-md-2",
                        ),
                        dbc.Button(
                            "SHARE PLOT",
                            href="#",
                            size="lg",
                            n_clicks=0,
                            id="test-button",
                            className="me-md-2",
                        ),
                    ],
                    className="d-inline-flex gap-2",
                    style={"padding": "0rem 0rem 0rem 0rem"},
                ),
            ],
            fluid=True,
        ),
        color="#E9ECEF",
        dark=False,
    )


def build_top_left_card() -> dmc.Paper:
    """
    Build the top-left card with wind rose, forecast, and photo tabs.

    Creates a tabbed card component that displays wind roses, weather forecasts,
    and station photos (when available). The photo tab is initially disabled
    and enabled dynamically for HydroMet stations.

    Returns:
        dmc.Paper: Mantine paper component with tabbed content for wind/weather/photo data.

    Note:
        - Wind rose tab shows aggregated wind conditions
        - Weather forecast tab embeds NWS forecast
        - Photo tab is only available for HydroMet stations with cameras
        - Uses clean Mantine styling with proper tab boundaries
    """
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    dmc.SegmentedControl(
                        data=[
                            {"label": "Wind Rose", "value": "wind-tab"},
                            {"label": "Weather Forecast", "value": "wx-tab"},
                            {"label": "Latest Photo", "value": "photo-tab"},
                        ],
                        id="ul-tabs",
                        value="wind-tab",
                        size="xs",
                        fullWidth=True,
                    ),
                    dmc.Divider(),
                    html.Div(
                        id="ul-content",
                        style={
                            "flex": 1,
                            "minHeight": "320px",
                            "padding": "0.5rem 0.5rem 0.5rem 0.5rem",
                            "overflow": "auto",
                        },
                    ),
                ],
                spacing="xs",
            )
        ],
        shadow="sm",
        p="sm",
        style={"height": "100%", "overflow": "hidden"},
    )


def build_bottom_left_card(station_fig: Any) -> dmc.Paper:
    """
    Build the bottom-left card with map, metadata, and current conditions tabs.

    Creates a tabbed card that displays the station locator map, metadata table,
    and current conditions summary. Content switches dynamically based on
    selected tab and station.

    Args:
        station_fig (Any): Initial station map figure or iframe component.

    Returns:
        dmc.Paper: Mantine paper component with tabbed content for station information.

    Note:
        - Map tab shows interactive station locations
        - Metadata tab displays station details and specifications
        - Current conditions tab shows latest observations and summaries
        - Default active tab is "data-tab" for current conditions
        - Uses clean Mantine styling with proper tab boundaries
    """
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    dmc.SegmentedControl(
                        data=[
                            {"label": "Locator Map", "value": "map-tab"},
                            {"label": "Station Metadata", "value": "meta-tab"},
                            {"label": "Current Conditions", "value": "data-tab"},
                        ],
                        id="bl-tabs",
                        value="data-tab",
                        size="xs",
                        fullWidth=True,
                    ),
                    dmc.Divider(),
                    html.Div(
                        id="bl-content",
                        children=html.Div(id="station-fig", children=station_fig),
                        style={
                            "height": "300px",
                            "overflow": "auto",
                            "maxHeight": "300px",
                        },
                    ),
                ],
                spacing="xs",
            )
        ],
        id="bl-card",
        shadow="sm",
        p="sm",
        style={"height": "100%", "maxHeight": "400px"},
    )


def make_station_dropdowns(
    stations: pd.DataFrame, id: str, station: Optional[str]
) -> dbc.Select:
    """
    Create a station selection dropdown component.

    Generates a Bootstrap select dropdown populated with all available
    Montana Mesonet stations, using long names for display and short
    names for values.

    Args:
        stations (pd.DataFrame): DataFrame containing station metadata.
        id (str): HTML element ID for the dropdown component.
        station (Optional[str]): Initially selected station value.

    Returns:
        dbc.Select: Bootstrap select component with station options.

    Note:
        - Uses long_name for display labels (includes network info)
        - Uses station short name for option values
        - Includes placeholder text for better UX
        - Can be used for multiple dropdowns with different IDs
    """
    return dbc.Select(
        options=[
            {"label": k, "value": v}
            for k, v in zip(stations["long_name"], stations["station"])
        ],
        id=id,
        placeholder="Select a Mesonet Station...",
        # className="stationSelect",
        value=station,
        # style={"width": "150%"}
    )


def build_control_sidebar(stations: pd.DataFrame) -> dmc.Stack:
    """
    Build the control sidebar with dropdowns and selection options using Dash Mantine Components.

    Creates a comprehensive control interface including station selection,
    date range picker, temporal aggregation options, network filters,
    and variable selection checkboxes in a vertical sidebar layout.

    Args:
        stations (pd.DataFrame): DataFrame containing station metadata.

    Returns:
        dmc.Stack: Mantine stack component with organized control sections.

    Note:
        - Station selection dropdown with search capability
        - Date range picker for time period selection
        - Time aggregation radio buttons (hourly/daily/raw)
        - Network filter checkboxes (HydroMet/AgriMet)
        - Variable selection with scrollable checkboxes
        - Includes tooltips and help links for user guidance
        - Collapsible design to save screen space
    """
    return dmc.Stack(
        [
            # Collapse/Expand Header
            dmc.Group(
                [
                    dmc.Text("Controls", weight=700, size="md"),
                    dmc.ActionIcon(
                        DashIconify(icon="tabler:chevron-left", width=20),
                        id="sidebar-collapse-btn",
                        variant="subtle",
                        size="sm",
                    ),
                ],
                position="apart",
            ),
            dmc.Divider(),
            # Station Selection
            dmc.Stack(
                [
                    dmc.Text("Station Selection", weight=600, size="sm"),
                    dmc.Select(
                        data=[
                            {"label": k, "value": v}
                            for k, v in zip(stations["long_name"], stations["station"])
                        ],
                        id="station-dropdown",
                        placeholder="Select a Mesonet Station...",
                        searchable=True,
                        clearable=True,
                        size="sm",
                    ),
                ],
                spacing="xs",
            ),
            # Date Selection
            dmc.Stack(
                [
                    dmc.Text("Date Range", weight=600, size="sm"),
                    dmc.Group(
                        [
                            dmc.DatePicker(
                                id="start-date",
                                label="Start Date",
                                value=dt.date.today() - rd(days=14),
                                maxDate=dt.date.today(),
                                size="xs",
                                style={"flex": 1},
                            ),
                            dmc.DatePicker(
                                id="end-date",
                                label="End Date",
                                value=dt.date.today(),
                                maxDate=dt.date.today(),
                                size="xs",
                                style={"flex": 1},
                            ),
                        ],
                        grow=True,
                    ),
                    dmc.Button(
                        "Display Period of Record",
                        id="por-button",
                        variant="light",
                        size="xs",
                        fullWidth=True,
                    ),
                ],
                spacing="xs",
            ),
            # Time Aggregation
            dmc.Stack(
                [
                    dmc.Text("Time Aggregation", weight=600, size="sm"),
                    dmc.ChipGroup(
                        children=[
                            dmc.Chip(
                                "Hourly", value="hourly", size="xs", variant="filled"
                            ),
                            dmc.Chip(
                                "Daily", value="daily", size="xs", variant="filled"
                            ),
                            dmc.Chip("Raw", value="raw", size="xs", variant="filled"),
                        ],
                        id="hourly-switch",
                        multiple=False,
                        value="hourly",
                    ),
                    dmc.Text(
                        "Hourly and daily averages are pre-computed and will load faster. "
                        "Avoid selecting periods longer than 1 year for daily, 3 months for hourly, "
                        "or 2 weeks for raw data.",
                        size="xs",
                        color="dimmed",
                        style={"fontStyle": "italic"},
                    ),
                ],
                spacing="xs",
            ),
            # GridMET Normals Toggle
            dmc.Stack(
                [
                    dmc.Text("Climate Normals", weight=600, size="sm"),
                    dmc.Switch(
                        label="Show gridMET Normals",
                        id="gridmet-switch",
                        size="sm",
                        disabled=True,
                    ),
                    dmc.Text(
                        "Shows 1991-2020 gridMET climate normals. Only available on daily data.",
                        size="xs",
                        color="dimmed",
                        style={"fontStyle": "italic"},
                    ),
                ],
                spacing="xs",
            ),
            # Network Selection
            dmc.Stack(
                [
                    dmc.Text("Network Filter", weight=600, size="sm"),
                    dmc.ChipGroup(
                        children=[
                            dmc.Chip(
                                "HydroMet",
                                value="HydroMet",
                                size="xs",
                                variant="filled",
                            ),
                            dmc.Chip(
                                "AgriMet", value="AgriMet", size="xs", variant="filled"
                            ),
                        ],
                        id="network-options",
                        value=["HydroMet", "AgriMet"],
                        multiple=True,
                    ),
                    dmc.Text(
                        "Filter stations by network type. Leave both checked to show all stations.",
                        size="xs",
                        color="dimmed",
                        style={"fontStyle": "italic"},
                    ),
                ],
                spacing="xs",
            ),
            # Variable Selection
            dmc.Stack(
                [
                    dmc.Text("Variables", weight=600, size="sm"),
                    dmc.ScrollArea(
                        children=[dmc.ChipGroup(id="select-vars", multiple=True)],
                        h=200,
                        type="scroll",
                    ),
                    dmc.Anchor(
                        dmc.Button(
                            "About These Variables",
                            variant="subtle",
                            size="xs",
                            fullWidth=True,
                        ),
                        href="https://climate.umt.edu/mesonet/variables/",
                        target="_blank",
                    ),
                ],
                spacing="xs",
            ),
        ],
        spacing="md",
        style={"padding": "0.75rem"},
    )


def build_main_plot_area() -> dmc.Paper:
    """
    Build the main plotting area without controls.

    Creates the primary visualization area containing just the plotting
    area with loading indicators and data storage components.

    Returns:
        dmc.Paper: Mantine paper component with plotting area.

    Note:
        - Contains the main plotting area with loading spinner
        - Includes session storage for temporary station data
        - Uses full height within parent container with proper scrolling
        - Clean design without header controls
    """
    return dmc.Paper(
        children=[
            dls.Bars(
                children=[
                    dcc.Store(id="temp-station-data", storage_type="session"),
                    dcc.Graph(id="station-data"),
                ]
            )
        ],
        shadow="sm",
        p="md",
        style={"height": "88vh", "overflow-y": "auto", "overflow-x": "hidden"},
    )


def build_latest_content(station_fig: Any, stations: pd.DataFrame) -> List[dbc.Col]:
    """
    Build the main station data view layout with sidebar controls and main content.

    Creates a three-column layout with controls on the left, main plotting area
    in the center, and supplementary information cards on the right.

    Args:
        station_fig (Any): Initial station map figure or component.
        stations (pd.DataFrame): DataFrame containing station metadata.

    Returns:
        List[dbc.Col]: List of Bootstrap column components for the layout.

    Note:
        - Left column (3/12): Control sidebar with all user inputs
        - Center column (6/12): Main plotting area
        - Right column (3/12): Wind/weather/photo and map/metadata/conditions cards
        - Responsive design: stacks vertically on smaller screens
        - Uses viewport height constraints (88vh) to prevent overflow
    """
    return [
        # Control Sidebar (Left) - Collapsible
        dbc.Col(
            dmc.Paper(
                children=[build_control_sidebar(stations)],
                shadow="sm",
                style={"height": "88vh", "overflow-y": "auto"},
                id="sidebar-content",
            ),
            xs={"size": 12, "order": "first"},
            sm={"size": 12, "order": "first"},
            md={"size": 4, "order": "first"},
            lg={"size": 3, "order": "first"},
            xl={"size": 3, "order": "first"},
            style={"padding": "0rem 0.25rem 0rem 0rem"},
            id="sidebar-col",
        ),
        # Main Plot Area (Center)
        dbc.Col(
            html.Div(
                [
                    # Floating toggle button (visible when sidebar is collapsed)
                    html.Div(
                        dmc.ActionIcon(
                            DashIconify(icon="tabler:menu-2", width=20),
                            id="sidebar-expand-btn",
                            variant="filled",
                            color="blue",
                            size="lg",
                            style={"display": "none"},
                        ),
                        style={
                            "position": "absolute",
                            "top": "10px",
                            "left": "10px",
                            "zIndex": 1000,
                        },
                    ),
                    build_main_plot_area(),
                ],
                id="latest-plots",
                style={"position": "relative"},
            ),
            xs={"size": 12, "order": "second"},
            sm={"size": 12, "order": "second"},
            md={"size": 8, "order": "second"},
            lg={"size": 6, "order": "second"},
            xl={"size": 6, "order": "second"},
            style={"padding": "0rem 0.25rem"},
            id="main-plot-col",
        ),
        # Info Cards (Right)
        dbc.Col(
            [
                dbc.Row(
                    build_top_left_card(),
                    className="h-50",
                    style={"padding": "0rem 0rem 0.25rem 0rem"},
                    id="top-card",
                ),
                dbc.Row(
                    build_bottom_left_card(station_fig),
                    className="h-50",
                    style={"padding": "0.25rem 0rem 0rem 0rem"},
                    id="bottom-card",
                ),
            ],
            xs={"size": 12, "order": "last"},
            sm={"size": 12, "order": "last"},
            md={"size": 12, "order": "last"},
            lg={"size": 3, "order": "last"},
            xl={"size": 3, "order": "last"},
            style={
                "maxHeight": "88vh",
                "overflow-y": "scroll",
                "overflow-x": "clip",
                "padding": "0rem 0rem 0rem 0.25rem",
            },
            id="sub-cards",
        ),
    ]


def build_downloader_content(
    station_fig, stations, elements, station=None, min_date=None
):
    station_dd = dmc.Select(
        data=[
            {"label": k, "value": v}
            for k, v in zip(stations["long_name"], stations["station"])
        ],
        id="station-dropdown-dl",
        placeholder="Select a Mesonet Station from the Map or Dropdown...",
        value=station,
        label="Select Station",
        searchable=True,
        clearable=True,
        # style={"width": "150%"}
    )
    element_dd = dmc.MultiSelect(
        data=elements,
        id="download-elements",
        clearable=True,
        value=None,
        label="Select Variable(s)",
        searchable=True,
        # style={"width": 400, "marginBottom": 10},
    )
    times = [
        {"value": "monthly", "label": "Monthly"},
        {"value": "daily", "label": "Daily"},
        {"value": "hourly", "label": "Hourly"},
        # {"value": "raw", "label": "Raw"},
    ]
    # station, variable(s) Aggregation Interval, Start Date, End Date
    return [
        dmc.Stack(
            [
                dmc.Group(
                    [
                        dmc.Stack(
                            [
                                station_dd,
                                element_dd,
                                dmc.Group(
                                    [
                                        dmc.Stack(
                                            [
                                                dmc.Switch(
                                                    size="md",
                                                    id="dl-public",
                                                    radius="xl",
                                                    label="Show Uncommon Variables",
                                                    checked=False,
                                                    disabled=False,
                                                ),
                                                dmc.Switch(
                                                    size="md",
                                                    id="dl-rmna",
                                                    radius="xl",
                                                    label="Remove Flagged Data",
                                                    checked=False,
                                                    disabled=False,
                                                ),
                                            ],
                                        ),
                                        dmc.Stack(
                                            [
                                                dmc.Text(
                                                    "Time Aggregation",
                                                    size="sm",
                                                    weight=500,
                                                ),
                                                dmc.ChipGroup(
                                                    [
                                                        dmc.Chip(
                                                            x["label"],
                                                            value=x["value"],
                                                        )
                                                        for x in times
                                                    ],
                                                    id="dl-timeperiod",
                                                    value="daily",
                                                ),
                                            ],
                                            justify="center",
                                        ),
                                    ],
                                    position="center",
                                    grow=True,
                                ),
                                dmc.Group(
                                    [
                                        dmc.DatePicker(
                                            id="dl-start",
                                            label="Start Date",
                                            minDate=min_date,
                                            maxDate=dt.date.today(),
                                            value=min_date,
                                        ),
                                        dmc.DatePicker(
                                            id="dl-end",
                                            label="End Date",
                                            minDate=min_date,
                                            maxDate=dt.date.today(),
                                            value=dt.date.today(),
                                        ),
                                    ],
                                    position="center",
                                    grow=True,
                                ),
                                dmc.Group(
                                    [
                                        dmc.Button(
                                            "Run Request",
                                            id="run-dl-request",
                                            variant="gradient",
                                        ),
                                        dmc.Button(
                                            "Download Data",
                                            id="dl-data-button",
                                            variant="gradient",
                                        ),
                                        dmc.Alert(
                                            "Please select a station and variable first!",
                                            color="red",
                                            withCloseButton=True,
                                            variant="filled",
                                            id="dl-alert",
                                            hide=True,
                                        ),
                                    ],
                                    position="center",
                                    grow=True,
                                ),
                                dcc.Download(id="downloader-data"),
                            ],
                            align="left",
                            justify="center",
                        ),
                        dbc.Col(
                            dbc.Card(
                                html.Div(
                                    dbc.CardBody(
                                        # id="bl-content",
                                        children=dcc.Graph(
                                            id="download-map", figure=station_fig
                                        ),
                                        className="card-text",
                                    ),
                                    # style={"overflow": "scroll"},
                                )
                            ),
                        ),
                    ],
                    grow=True,
                ),
                dmc.Stack(
                    [
                        html.Div(
                            children=[
                                dcc.Store("dl-data", storage_type="memory"),
                                dmc.Stack(
                                    id="dl-plots", align="strech", justify="center"
                                ),
                            ]
                        )
                    ],
                    align="strech",
                    justify="center",
                ),
            ]
        ),
        dmc.Footer(
            height=40,
            fixed=True,
            children=[
                dmc.Text(
                    "Supported by Bureau of Land Management (RM-CESU Award L16AC00359)",
                    weight=800,
                )
            ],
            style={"backgroundColor": "#129dff"},
        ),
    ]


def build_gdd_selector() -> List[Any]:
    """
    Build the Growing Degree Day (GDD) crop selection interface.

    Creates a control panel for selecting crop types and temperature
    thresholds for growing degree day calculations, used in the
    derived variables section.

    Returns:
        List[Any]: List of Dash Mantine Components for GDD selection:
            - Centered text label
            - Chip group for crop type selection
            - Range slider for temperature thresholds (disabled by default)

    Note:
        - Supports common Montana crops (wheat, barley, canola, etc.)
        - Default selection is wheat with 50-86°F range
        - Range slider is disabled initially (controlled by crop selection)
        - Uses Dash Mantine Components for modern UI styling
    """
    gdd_items = [
        ("wheat", "Wheat"),
        ("barley", "Barley"),
        ("canola", "Canola"),
        ("corn", "Corn"),
        ("sunflower", "Sunflower"),
        ("sugarbeet", "Sugarbeet"),
        ("hemp", "Hemp"),
    ]
    return [
        dmc.Center(
            dmc.Text(
                "GDD Generic Crop Type",
                size="sm",
                weight=500,
            )
        ),
        dmc.Center(
            dmc.ChipGroup(
                [dmc.Chip(v, value=k, size="xs") for k, v in gdd_items],
                id="gdd-selection",
                value="wheat",
                style={"text-align": "center"},
                # mt=10,
            )
        ),
        dmc.RangeSlider(
            id="gdd-slider",
            value=[50, 86],
            marks=[
                {"value": 30, "label": "30°F"},
                # {"value": 40, "label": "40°F"},
                {"value": 50, "label": "50°F"},
                # {"value": 60, "label": "60°F"},
                {"value": 70, "label": "70°F"},
                # {"value": 80, "label": "80°F"},
                {"value": 90, "label": "90°F"},
                # {"value": 100, "label": "100°F"},
            ],
            disabled=True,
            min=30,
            max=100,
            step=1,
            minRange=1,
            maxRange=100,
            mb=35,
        ),
    ]


def build_derived_dropdowns(
    stations,
    station=None,
):
    return dmc.Grid(
        children=[
            dmc.Col(
                dmc.Stack(
                    [
                        dmc.Select(
                            data=[
                                {"label": k, "value": v}
                                for k, v in zip(
                                    stations["long_name"], stations["station"]
                                )
                            ],
                            id="station-dropdown-derived",
                            placeholder="Select a Mesonet Station Dropdown...",
                            value=station,
                            label=html.P(["Select Station", html.Br()]),
                            searchable=True,
                            # style={"width": "150%"}
                        ),
                        dmc.Group(
                            [
                                dmc.Stack(
                                    [
                                        dmc.Text("Select Variable"),
                                        dmc.Select(
                                            data=[
                                                {
                                                    "value": "etr",
                                                    "label": "Reference ET",
                                                },
                                                {
                                                    "value": "feels_like",
                                                    "label": "Feels Like Temperature",
                                                },
                                                {
                                                    "value": "gdd",
                                                    "label": "Growing Degree Days",
                                                },
                                                {
                                                    "value": "soil_temp,soil_ec_blk",
                                                    "label": "Soil Profile Plot",
                                                },
                                                {
                                                    "value": "",
                                                    "label": "Annual Comparison Plot",
                                                },
                                                {
                                                    "value": "cci",
                                                    "label": "Livestock Risk Index",
                                                },
                                                {
                                                    "value": "swp",
                                                    "label": "Soil Water Potential",
                                                },
                                                {
                                                    "value": "percent_saturation",
                                                    "label": "Percent Soil Saturation",
                                                },
                                            ],
                                            id="derived-vars",
                                            value="gdd",
                                            searchable=True,
                                            # style={"width": 400, "marginBottom": 10},
                                        ),
                                    ]
                                ),
                                dmc.Stack(
                                    [
                                        dmc.Text(html.Br()),
                                        dmc.Anchor(
                                            dmc.Button(
                                                "Learn More",
                                                # href="/mesonet/dashboard/ag_tools/"
                                                leftIcon=DashIconify(
                                                    icon="feather:info", width=20
                                                ),
                                            ),
                                            href="https://climate.umt.edu/mesonet/dashboard/ag_tools/",
                                            id="derived-link",
                                            target="_blank",
                                        ),
                                    ]
                                ),
                            ],
                            grow=True,
                            spacing="xl",
                            position="left",
                        ),
                    ]
                ),
                span=4,
            ),
            dmc.Col(
                dmc.Stack(
                    [
                        dmc.DatePicker(
                            id="start-date-derived",
                            label="Start Date",
                            # minDate=min_date,
                            maxDate=dt.date.today(),
                            value=dt.date.today() - rd(days=365),
                        ),
                        dmc.DatePicker(
                            id="end-date-derived",
                            value=dt.date.today() + rd(days=1),
                            maxDate=dt.date.today() + rd(days=1),
                            label="End Date",
                        ),
                    ]
                ),
                span=4,
            ),
            dmc.Col(
                id="derived-gdd-panel",
                children=dmc.Stack(build_gdd_selector()),
                span=4,
            ),
            dmc.Col(
                id="derived-annual-panel",
                children=dmc.Stack(
                    [
                        dmc.Select(
                            id="annual-dropdown",
                            label="Comparison Variable",
                            placeholder="Select a Variable...",
                        )
                    ]
                ),
                span=4,
            ),
            dmc.Col(
                id="derived-timeagg-panel",
                children=dmc.Stack(
                    [
                        dmc.Center(
                            [
                                dmc.Text("Time Aggregation:"),
                                dmc.ChipGroup(
                                    [
                                        dmc.Chip(v, value=k, size="xs")
                                        for k, v in [
                                            ("hourly", "Hourly"),
                                            ("daily", "Daily"),
                                        ]
                                    ],
                                    id="derived-timeagg",
                                    value="daily",
                                    style={"text-align": "center"},
                                    # mt=10,
                                ),
                            ]
                        ),
                        dmc.Center(
                            id="livestock-container",
                            children=[
                                dmc.Text("Livestock Type:"),
                                dmc.ChipGroup(
                                    [
                                        dmc.Chip(v, value=k, size="xs")
                                        for k, v in [
                                            ("adult", "Adult"),
                                            ("newborn", "Newborn"),
                                        ]
                                    ],
                                    id="livestock-type",
                                    value="adult",
                                    style={"text-align": "center"},
                                    # mt=10,
                                ),
                            ],
                        ),
                    ]
                ),
                span=4,
                style={"display": "none"},
            ),
            dmc.Col(
                id="derived-soil-panel",
                children=dmc.Stack(
                    [
                        dmc.Text("Soil Variable to Plot"),
                        dmc.ChipGroup(
                            [
                                dmc.Chip(v, value=k, size="xs")
                                for k, v in [
                                    ("soil_blk_ec", "Electrical Conductivity"),
                                    ("soil_vwc", "Volumetric Water Content"),
                                    ("soil_temp", "Temperature"),
                                    ("swp", "Soil Water Potential"),
                                    ("percent_saturation", "Percent Saturation"),
                                ]
                            ],
                            id="derived-soil-var",
                            value="soil_vwc",
                            style={"text-align": "center"},
                            # mt=10,
                        ),
                    ]
                ),
                span=4,
                style={"display": "none"},
            ),
        ],
        # position="center",
        # spacing="sm",
        grow=True,
        justify="space-around",
        align="center",
    )


def build_satellite_ts_selector():
    return (
        dbc.Col(
            [
                dbc.Checklist(
                    options=[{"label": "Percentiles", "value": 1}],
                    id="climatology-switch",
                    switch=True,
                    value=[1],
                    # className="toggle",
                ),
                dbc.Tooltip(
                    """
                Show the 5th and 95th percentile of observations for the period of record.
                """,
                    target="climatology-switch",
                ),
            ],
            xs=12,
            sm=12,
            md=2,
            lg=2,
            xl=2,
        ),
        dbc.Col(
            [
                dbc.InputGroup(
                    dbc.InputGroupText(
                        [
                            dbc.Checklist(
                                options=[
                                    {"value": "ET", "label": "ET"},
                                    {"value": "EVI", "label": "EVI"},
                                    {"value": "Fpar", "label": "FPAR"},
                                    {"value": "GPP", "label": "GPP"},
                                    {"value": "LAI", "label": "LAI"},
                                    {"value": "NDVI", "label": "NDVI"},
                                    {"value": "PET", "label": "PET"},
                                    # {
                                    #     "label": "Rootzone Soil Moisture",
                                    #     "value": "sm_rootzone",
                                    # },
                                    # {
                                    #     "label": "Rootzone Soil Saturation",
                                    #     "value": "sm_rootzone_wetness",
                                    # },
                                    # {
                                    #     "label": "Surface Soil Moisture",
                                    #     "value": "sm_surface",
                                    # },
                                    # {
                                    #     "label": "Surface Soil Saturation",
                                    #     "value": "sm_surface_wetness",
                                    # },
                                ],
                                inline=True,
                                id="sat-vars",
                                value=["ET", "GPP", "NDVI"],
                            )
                        ],
                        style={"overflow-x": "scroll"},
                    ),
                    # className="mb-3",
                    size="lg",
                )
            ],
            xs=12,
            sm=12,
            md=6,
            lg=6,
            xl=6,
        ),
    )


def build_satellite_comp_selector(sat_compare_mapper):
    return [
        dbc.Col(
            dbc.Row(
                [
                    dbc.Select(
                        options=[
                            {"label": k, "value": v}
                            for k, v in sat_compare_mapper.items()
                        ],
                        id="compare1",
                        placeholder="Select an X-Axis...",
                        className="stationSelect",
                        # style={"width": "150%"}
                    ),
                    dbc.Select(
                        options=[
                            {"label": k, "value": v}
                            for k, v in sat_compare_mapper.items()
                        ],
                        id="compare2",
                        placeholder="Select a Y-Axis...",
                        className="stationSelect",
                        # style={"width": "150%"}
                    ),
                ]
            ),
            xs=5,
            sm=5,
            md=2,
            lg=2,
            xl=2,
        ),
        dbc.Col(
            dbc.InputGroup(
                [
                    dbc.InputGroupText("Start Date"),
                    dcc.DatePickerSingle(
                        id="start-date-satellite",
                        date=dt.date.today() - rd(years=1),
                        max_date_allowed=dt.date.today(),
                        # min_date_allowed=dt.date(2022, 1, 1),
                        disabled=False,
                    ),
                ]
            ),
            xs=5,
            sm=5,
            md=3,
            lg=3,
            xl=3,
            # style={"padding": "0rem 0rem 0rem 6.5rem"},
        ),
        dbc.Col(
            dbc.InputGroup(
                [
                    dbc.InputGroupText("End Date"),
                    dcc.DatePickerSingle(
                        id="end-date-satellite",
                        date=dt.date.today(),
                        max_date_allowed=dt.date.today(),
                        # min_date_allowed=dt.date(2022, 1, 1),
                        disabled=False,
                    ),
                ]
            ),
            xs=5,
            sm=5,
            md=3,
            lg=3,
            xl=3,
            # style={"padding": "0rem 0rem 0rem 6.5rem"},
        ),
    ]


def build_satellite_dropdowns(
    stations, timeseries=True, station=None, sat_compare_mapper=None
):
    if timeseries:
        content = build_satellite_ts_selector()
    else:
        content = build_satellite_comp_selector(sat_compare_mapper)

    children = [
        dbc.Col(
            make_station_dropdowns(stations, "station-dropdown-satellite", station),
            xs=12,
            sm=12,
            md=2,
            lg=2,
            xl=2,
        ),
        dbc.Col(
            dmc.ChipGroup(
                children=[
                    dmc.Chip(
                        "Timeseries Plot",
                        value="timeseries",
                        size="xs",
                        variant="filled",
                    ),
                    dmc.Chip(
                        "Comparison Plot", value="compare", size="xs", variant="filled"
                    ),
                ],
                value="timeseries" if timeseries else "compare",
                id="satellite-radio",
                multiple=False,
            ),
            xs=12,
            sm=12,
            md=2,
            lg=2,
            xl=2,
        ),
    ]
    children += content
    return (
        dbc.Row(
            children=children,
            align="center",
            # style={"padding": "0.75rem 0rem 0rem 0rem"},
        ),
    )


def build_derived_content(station):
    selectors = build_derived_dropdowns(station)
    return dbc.Card(
        [
            dbc.CardHeader(
                dbc.Container(selectors, fluid=True, id="derived-selectors")
            ),
            dbc.CardBody(
                html.Div(
                    [
                        dls.Bars(
                            children=[
                                dcc.Store(
                                    id="temp-derived-data", storage_type="session"
                                ),
                                dcc.Graph(id="derived-plot"),
                            ]
                        )
                    ]
                )
            ),
        ],
        color="secondary",
        outline=True,
        className="h-100",
        style={"overflow-x": "clip"},
    )


def build_satellite_content(stations):
    selectors = build_satellite_dropdowns(stations)
    return dbc.Card(
        [
            dbc.CardHeader(
                dbc.Container(selectors, fluid=True, id="satellite-selectors")
            ),
            dbc.CardBody(
                html.Div([dcc.Graph(id="satellite-plot")], id="satellite-graph")
            ),
        ],
        color="secondary",
        outline=True,
        className="h-100",
        style={"overflow-x": "clip"},
    )


def app_layout(app_ref, stations):
    stations = stations.to_json(orient="records")
    return dbc.Container(
        children=[
            dcc.Location(id="url", refresh=False),
            dcc.Store(data=stations, id="mesonet-stations", storage_type="memory"),
            dcc.Store(data="", id="triggered-by", storage_type="memory"),
            build_banner(app_ref),
            dmc.Paper(
                children=[
                    dmc.Tabs(
                        children=[
                            dmc.TabsList(
                                [
                                    dmc.Tab("Latest Data", value="station-tab"),
                                    dmc.Tab("Ag Tools", value="derived-tab"),
                                    dmc.Tab("Data Downloader", value="download-tab"),
                                    dmc.Tab(
                                        "Satellite Indicators", value="satellite-tab"
                                    ),
                                ],
                                grow=True,
                            ),
                        ],
                        id="main-display-tabs",
                        value="station-tab",
                        variant="outline",
                        color="blue",
                        style={"width": "100%"},
                    )
                ],
                shadow="sm",
                p="xs",
                style={"marginBottom": "0.25rem"},
            ),
            dbc.Row(className="h-100", id="main-content"),
            generate_modal(),
            # feedback_iframe(),
            dbc.Modal(
                [],
                id="no-funding-modal",
                is_open=False,
                size="md",
                centered=True,
                scrollable=True,
            ),
            dbc.Modal(
                id="station-modal",
                is_open=False,
                size="sm",
                centered=True,
                scrollable=True,
            ),
        ],
        fluid=True,
        style={
            "height": "100%",
            "backgroundColor": "#E9ECEF",
            "padding": "0rem 1rem 0rem 1rem",
            "overflow-y": "clip",
        },
    )
