from dash import Dash, dcc, html, Input, Output, callback

from layouts import station_map_page, site_page
from pathlib import Path

external_stylesheets = ["https://codepen.io/chriddyp/pen/bWLwgP.css"]
app = Dash(
    __name__,
    suppress_callback_exceptions=True,
    external_stylesheets=external_stylesheets,
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
                    html.Button(
                        id="feedback-button", children="GIVE FEEDBACK", n_clicks=0
                    ),
                    html.Button(id="help-button", children="HELP", n_clicks=0),
                    html.A(
                        html.Img(id="logo", src=app.get_asset_url("MCO_logo.svg")),
                        href="https://climate.umt.edu/",
                    ),
                ],
            ),
        ],
    )


app.layout = html.Div(
    [
        dcc.Location(id="url", refresh=False),
        build_banner(),
        html.Div(id="page-content"),
        dcc.Store(id="station-data"),
    ]
)


@callback(Output("page-content", "children"), Input("url", "pathname"))
def display_page(pathname):
    print(Path(pathname))
    return station_map_page


# @app.callback(Output("url", "pathname"), Input("station-dropdown", "value"))
# def update_url_on_dropdown_change(dropdown_value):
#     return dropdown_value


# @callback(Output("selected-site", "children"), Input("station-dropdown", "value"))
# def display_value(value):
#     return f"You have selected {value}"


if __name__ == "__main__":
    app.run_server(debug=True)
