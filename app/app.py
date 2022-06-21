from dash import callback_context, Dash, dcc, html, Input, Output, dash_table, State
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

import datetime as dt
from dateutil.relativedelta import relativedelta as rd
from pathlib import Path

from .libs.get_data import (
    get_sites,
    clean_format,
    get_station_latest,
    filter_top_of_hour,
)
from .libs.plotting import plot_site, plot_station, plot_wind, plot_latest_ace_image
from .libs.tables import make_metadata_table
from .layout import app_layout, table_styling

# from libs.get_data import (
#     get_sites,
#     clean_format,
#     get_station_latest,
#     filter_top_of_hour,
# )
# from libs.plotting import plot_site, plot_station, plot_wind, plot_latest_ace_image
# from libs.tables import make_metadata_table
# from layout import app_layout, table_styling

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

stations = get_sites()
station_fig = plot_station(stations)

app.layout = app_layout(app_ref=app, station_fig=station_fig, stations=stations)


def make_nodata_figure():
    fig = go.Figure()
    fig.add_annotation(
        dict(
            font=dict(color="black", size=15),
            x=0.5,
            y=0.5,
            showarrow=False,
            text="No data avaliable for selected dates.",
            textangle=0,
            xanchor="center",
            xref="paper",
            yref="paper",
        )
    )
    return fig


@app.callback(
    Output("banner-title", "children"),
    [Input("station-dropdown", "value"), Input("station-dropdown", "options")],
)
def update_banner_text(station, options):
    return (
        f"The Montana Mesonet Dashboard: {options[station]}"
        if station
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
    if station is None or tmp_data is None:
        return dcc.Graph(id="station-fig", figure=station_fig)

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
            data = clean_format(station, start_time=start, end_time=end, hourly=len(hourly) == 1)
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

    return make_nodata_figure()


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
        Input("start-date", "date"),
        Input("end-date", "date"),
    ],
)
def update_ul_card(at, station, tmp_data, start_date, end_date):
    if station is None or tmp_data is None:
        return html.Div()

    if at == "wind-tab":
        if tmp_data != -1:
            data = pd.read_json(tmp_data, orient="records")
            data.datetime = data.datetime.dt.tz_convert("America/Denver")
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


# TODO: Make download only happen on button click, not after when station changes.
# @app.callback(
#     Output("data-download", "data"),
#     [
#         Input("download-button", "n_clicks"),
#         Input("temp-station-data", "data"),
#         Input("start-date", "date"),
#         Input("end-date", "date"),
#         Input("station-dropdown", "value"),
#     ],
#     prevent_initial_callback=True,
# )
# def download_called_data(n_clicks, tmp_data, start: dt.date, end: dt.date, station):

#     ctx = callback_context
#     flag = ctx.triggered[0]["prop_id"] == "download-button.n_clicks"
#     if flag and tmp_data:
#         data = pd.read_json(tmp_data, orient="records")
#         data = data.assign(datetime=data.datetime.dt.tz_convert("America/Denver"))
#         return dcc.send_data_frame(
#             data.to_csv,
#             f"{station}_MTMesonet_{start.replace('-', '')}_{end.replace('-', '')}.csv",
#         )


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



if __name__ == "__main__":
    app.run_server(debug=True)
