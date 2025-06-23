import dash
import dash_bootstrap_components as dbc
import dash_mantine_components as dmc
import polars as pl
import httpx
from dash import html, dcc, callback, Input, Output

API_URL = "https://mesonet.climate.umt.edu/api/elements?type=csv&public=False"

def get_elements() -> pl.DataFrame:
    r = httpx.get(
        API_URL,
        params={
            "type": "csv",
            "public": "False"
        }
    )
    not_public = pl.read_csv(r.content)

    r = httpx.get(
        API_URL,
        params={
            "type": "csv",
            "public": "True"
        }
    )
    public = pl.read_csv(r.content)

    return pl.concat([
        not_public.join(public, on=not_public.columns, how="anti").with_columns(pl.lit(False).alias("public")),
        public.with_columns(pl.lit(True).alias("public"))
    ])

def get_stations() -> pl.DataFrame:
    r = httpx.get(
        "https://mesonet.climate.umt.edu/api/stations?type=csv"
    )
    return pl.read_csv(r.content)

elements = get_elements()
stations = get_stations()

app = dash.Dash(
    __name__,
    title="Montana Mesonet",
    external_stylesheets=[dbc.themes.YETI, dbc.icons.FONT_AWESOME],
    meta_tags=[
        {
            "name": "viewport",
            "content": "width=device-width, initial-scale=1.0, maximum-scale=1.2, minimum-scale=0.5,",
        }
    ],
    requests_pathname_prefix="/",
    external_scripts=[
        "https://www.googletagmanager.com/gtag/js?id=UA-149859729-3",
        "https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/develop/app/assets/gtag.js",
    ],
)


def build_navbar():
    return dbc.Navbar(
        dbc.Container(
            [
                html.A(
                    # Use row and col to control vertical alignment of logo / brand
                    dbc.Row(
                        [
                            dbc.Col(html.Img(
                                            id="pls-work",
                                            src=app.get_asset_url("MCO_logo.svg"),
                                            height="50px",
                                            alt="MCO Logo",
                                        )),
                            dbc.Col(dbc.NavbarBrand("Navbar", className="ms-2")),
                        ],
                        align="center",
                        className="g-0",
                    ),
                    href="https://placehold.co/",
                    style={"textDecoration": "none"},
                ),
                dbc.NavbarToggler(id="navbar-toggler", n_clicks=0),
            ]
        ),
        dark=True,
    )

app.layout = dbc.Container(
    children=[
        build_navbar(),
        dbc.Alert("Hello Bootstrap!", color="success"),
    ],
    style={
        "height": "100vh",
        "backgroundColor": "#1C4369",
        "padding": "0rem 0rem 0rem 0rem",
        "overflow-y": "clip",
    },
    className="p-5",
    fluid=True,
)

if __name__ == "__main__":
    app.run(debug=True)
