import datetime as dt
from pathlib import Path

import dash_bootstrap_components as dbc
import pandas as pd
import plotly.graph_objects as go
from dash import Dash, Input, Output, State, dash_table, dcc, html
from dateutil.relativedelta import relativedelta as rd

# from .layout import (
#     app_layout,
#     build_latest_content,
#     build_satellite_content,
#     build_satellite_dropdowns,
#     table_styling,
# )
# from .libs.get_data import (
#     clean_format,
#     filter_top_of_hour,
#     get_satellite_data,
#     get_sites,
#     get_station_latest,
# )
# from .libs.plot_satellite import plot_all, plot_comparison
# from .libs.plotting import plot_latest_ace_image, plot_site, plot_station, plot_wind
# from .libs.tables import make_metadata_table

from libs.get_data import (
    get_sat_compare_data,
    get_sites,
    clean_format,
    get_station_latest,
    filter_top_of_hour,
    get_satellite_data,
)
from libs.plotting import plot_site, plot_station, plot_wind, plot_latest_ace_image
from libs.tables import make_metadata_table
from layout import (
    app_layout,
    table_styling,
    build_latest_content,
    build_satellite_content,
    build_satellite_dropdowns,
)
from libs.params import params
from libs.plot_satellite import plot_all, plot_comparison

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
    # requests_pathname_prefix="/dash/",
    external_scripts=[
        "https://www.googletagmanager.com/gtag/js?id=UA-149859729-3",
        "https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/develop/app/assets/gtag.js",
    ],
)

app._favicon = "MCO_logo.svg"
server = app.server

stations = get_sites()
station_fig = plot_station(stations)

app.layout = app_layout(app_ref=app)


def make_nodata_figure(txt="No data avaliable for selected dates."):
    fig = go.Figure()
    fig.add_annotation(
        dict(
            font=dict(color="black", size=18),
            x=0.5,
            y=0.5,
            showarrow=False,
            text=txt,
            textangle=0,
            xanchor="center",
            xref="paper",
            yref="paper",
        )
    )
    fig.update_layout(
        yaxis_visible=False,
        yaxis_showticklabels=False,
        xaxis_visible=False,
        xaxis_showticklabels=False,
        paper_bgcolor="white",
        plot_bgcolor="white",
    )
    return fig


@app.callback(
    Output("banner-title", "children"),
    [Input("station-dropdown", "value")],
)
def update_banner_text(station):
    return (
        f"The Montana Mesonet Dashboard: {stations[stations['station'] == station].station.values[0]}"
        if station != ''
        else "The Montana Mesonet Dashboard"
    )


@app.callback(
    Output("bl-content", "children"),
    [
        Input("bl-tabs", "active_tab"),
        Input("station-dropdown", "value"),
        Input("temp-station-data", "data"),
    ],
)
def update_bl_card(at, station, tmp_data):
    if at == "map-tab":
        return dcc.Graph(id="station-fig", figure=station_fig)
    elif at == "meta-tab":
        table = make_metadata_table(stations, station)
        return dash_table.DataTable(data=table, **table_styling)

    else:
        if tmp_data != -1:
            table = get_station_latest(station)
            return dash_table.DataTable(data=table, **table_styling)
        return dcc.Graph(figure=make_nodata_figure())


@app.callback(
    Output("temp-station-data", "data"),
    [
        Input("station-dropdown", "value"),
        Input("start-date", "date"),
        Input("end-date", "date"),
        Input("hourly-switch", "value"),
    ],
)
def get_latest_api_data(station, start, end, hourly):

    if (start or end) and station:
        start = dt.datetime.strptime(start, "%Y-%m-%d").date()
        end = dt.datetime.strptime(end, "%Y-%m-%d").date()

        hourly = [hourly] if isinstance(hourly, int) else hourly

        try:
            data = clean_format(
                station, start_time=start, end_time=end, hourly=len(hourly) == 1
            )
        except AttributeError as e:
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
        return make_nodata_figure()

    elif tmp_data and tmp_data != -1:
        data = pd.read_json(tmp_data, orient="records")
        data.datetime = data.datetime.dt.tz_convert("America/Denver")
        if len(hourly) == 1:
            data = filter_top_of_hour(data)

        dat = data.drop(columns="Precipitation [in]")
        ppt = data[["datetime", "Precipitation [in]"]]
        ppt = ppt.dropna()
        select_vars = [select_vars] if isinstance(select_vars, str) else select_vars
        station = stations[stations["station"] == station]
        return plot_site(
            *select_vars,
            dat=dat,
            ppt=ppt,
            station=station,
            norm=len(norm) == 1,
            top_of_hour=len(hourly) == 1,
        )

    return make_nodata_figure(
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
            fig = plot_wind(data)
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

            return (
                html.Div(
                    children=dcc.Graph(figure=fig, style={"height": "40vh"}),
                ),
            )
        return (
            html.Div(
                dcc.Graph(
                    figure=make_nodata_figure(),
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
            ],
        )


@app.callback(
    Output("photo-figure", "figure"),
    [Input("station-dropdown", "value"), Input("photo-direction", "value")],
)
def update_photo_direction(station, direction):
    return plot_latest_ace_image(station, direction=direction)


@app.callback(
    [Output("station-modal", "children"), Output("station-modal", "is_open")],
    [Input("station-fig", "clickData")],
    [State("station-modal", "is_open")],
)
def station_popup(clickData, is_open):

    if clickData:
        lat, lon, name, elevation, href, _ = clickData["points"][0]["customdata"]
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
        return build_latest_content(station_fig=station_fig, stations=stations)
    elif sel == "satellite-tab":
        return build_satellite_content(stations)
    else:
        return build_latest_content(station_fig=station_fig, stations=stations)


@app.callback(
    [Output("satellite-selectors", "children"), Output("satellite-graph", "children")],
    Input("satellite-radio", "value"),
    State("station-dropdown-satellite", "value"),
)
def update_sat_selectors(sel, station):
    if sel == "timeseries":
        graph = dcc.Graph(id="satellite-plot")
    else:
        graph = dcc.Graph(id="satellite-compare")

    return (
        build_satellite_dropdowns(stations, sel == "timeseries", station=station),
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
        return make_nodata_figure(
            """
        <b>No station selected!</b> <br><br>
        
        To get started, select a station from the dropdown.
        """
        )

    if len(elements) == 0:
        return make_nodata_figure(
            """
        <b>No indicators selected!</b> <br><br>
        
        Select an indicator from the checkbox to view the plot. 
        """
        )

    start_time = dt.date(2000, 1, 1)
    end_time = dt.date.today()
    dfs = {
        x: get_satellite_data(
            station=station, element=x, start_time=start_time, end_time=end_time
        )
        for x in elements
    }

    return plot_all(dfs, climatology=climatology)


@app.callback(
    Output("compare2", "disabled"),
    Input("compare1", "value")
)
def enable_compare2(val):
    return val is None


@app.callback(
    Output("compare2", "options"),
    Input("station-dropdown-satellite", "value")
)
def update_compare2_options(station):
    options = [{"label": "SATELLITE VARIABLES", "value": "SATELLITE VARIABLES", "disabled": True},
    {"label": "-"*30, "value":  "-"*30, "disabled": True}]
    options += [{"label": k, "value": v} for k, v in params.sat_compare_mapper.items()]
    if station is None:
        return options
    
    station_elements = pd.read_csv(f"https://fcfc-mesonet-staging.cfc.umt.edu/api/v2/station_elements/{station}/?type=csv")
    station_elements = station_elements.sort_values("description_short")
    elements = [{"label": "STATION VARIABLES", "value": "STATION VARIABLES", "disabled": True},
    {"label":  "-"*32, "value":  "-"*32, "disabled": True}]
    elements += [{"label": k, "value": v} for k, v in zip(station_elements.description_short, station_elements.element)]
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
def render_satellite_comp_plot(station, value1, value2, start_time, end_time):
    start_time = dt.datetime.strptime(start_time, "%Y-%m-%d").date()
    end_time = dt.datetime.strptime(end_time, "%Y-%m-%d").date()

    if station is None:
        return make_nodata_figure(
            """
        <b>No station selected!</b> <br><br>
        
        To get started, select a station from the dropdown.
        """
        )
    if not (value1 and value2):
        return make_nodata_figure(
            """
        <b>No indicators selected!</b> <br><br>
        
        Please select two indicators to view the plot. 
        """
        )
    # end_time = dt.date.today()
    # start_time = dt.date(2000, 1, 1)
    element1, platform1 = value1.split("-")
    try:
        element2, platform2 = value2.split("-")
        dat1 = get_satellite_data(
            station=station,
            element=element1,
            start_time=start_time,
            end_time=end_time,
            platform=platform1,
            modify_dates=False,
        )
        dat2 = get_satellite_data(
            station=station,
            element=element2,
            start_time=start_time,
            end_time=end_time,
            platform=platform2,
            modify_dates=False,
        )

    except ValueError:
        element2, platform2 = value2, "Station"

        dat1, dat2 = get_sat_compare_data(
            station=station,
            sat_element=element1,
            station_element=element2,
            start_time=start_time,
            end_time=end_time,
            platform=platform1,
        )

        dat2 = dat2.assign(platform=platform2)
        dat2 = dat2.assign(element=element2)


    return plot_comparison(dat1, dat2)


if __name__ == "__main__":
    app.run_server(debug=True)
