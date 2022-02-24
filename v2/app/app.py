import dash
from dash import dcc, html
import plotly.express as px
from dash.dependencies import Input, Output

from get_data import get_sites
from plotting import style_figure, plot_site

# TODO: Multiple endpoints with multiple apps: https://dash.plotly.com/urls


def plot_stations(sites):

    fig = px.scatter_mapbox(
        sites,
        lat="latitude",
        lon="longitude",
        hover_name="name",
        hover_data=["station"],
        zoom=4.5,
        height=300,
    )
    fig.update_layout(mapbox_style="stamen-terrain")
    fig.update_layout(margin={"r": 0, "t": 0, "l": 0, "b": 0})
    return fig


sites = get_sites()
fig = plot_stations(sites)
external_stylesheets = ["https://codepen.io/chriddyp/pen/bWLwgP.css"]

app = dash.Dash(
    __name__,
    external_stylesheets=external_stylesheets,
    suppress_callback_exceptions=True,
)
server = app.server


def build_banner():
    return html.Div(
        id="banner",
        className="banner",
        children=[
            html.Div(
                id="banner-text",
                children=[
                    html.H5("Montana Mesonet Dashboard"),
                    html.H6("Download and View Data from Montana Weather Stations"),
                ],
            ),
            html.Div(
                id="banner-logo",
                children=[
                    # TODO: a Modal to make this button render popup: https://github.com/plotly/dash-sample-apps/blob/main/apps/dash-manufacture-spc-dashboard/app.py#L234
                    html.Button(id="help-button", children="HELP", n_clicks=0),
                    html.A(
                        html.Img(id="logo", src=app.get_asset_url("MCO_logo.svg")),
                        href="https://climate.umt.edu/",
                    ),
                ],
            ),
        ],
    )


def build_tabs():
    return html.Div(
        id="tabs",
        className="tabs",
        children=[
            dcc.Tabs(
                id="app-tabs",
                value="tab-station",
                className="custom-tabs",
                children=[
                    dcc.Tab(
                        label="Latest Station Data",
                        value="tab-station",
                        className="custom-tab",
                        selected_className="custom-tab--selected",
                    ),
                    dcc.Tab(
                        label="Mesonet Map",
                        value="tab-map",
                        className="custom-tab",
                        selected_className="custom-tab--selected",
                    ),
                    dcc.Tab(
                        label="Mesonet Data Download",
                        value="tab-download",
                        className="custom-tab",
                        selected_className="custom-tab--selected",
                    ),
                ],
            )
        ],
    )


app.layout = html.Div(
    id="main-app-container",
    children=[
        build_banner(),
        build_tabs(),
        html.Div(id="app-content"),
    ],
)


@app.callback(Output("app-content", "children"), Input("app-tabs", "value"))
def render_tab_content(tab):
    if tab == "tab-station":
        return html.Div(
            id="station-plots",
            children=[
                dcc.Graph(id="station-data", figure=fig),
                # TODO: Somewhere in here is where the errors are coming from
                dcc.Graph(id="weather-plots", figure=style_figure(px.line())),
            ],
        )
    elif tab == "tab-map":
        return html.Iframe(
            src="https://mesonet.climate.umt.edu/api/v2/map/",
            style={"height": "700px", "width": "100%"},
        )

    return html.Div()


@app.callback(Output("weather-plots", "figure"), Input("station-data", "clickData"))
def display_click_data(clickData):
    if clickData:
        station = clickData["points"][0]["customdata"]
        return plot_site(station)
    return style_figure(px.line())


if __name__ == "__main__":
    app.run_server(debug=True)
