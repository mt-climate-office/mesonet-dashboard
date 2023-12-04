import numpy as np
import plotly.graph_objects as go
from dateutil.relativedelta import relativedelta as rd
from plotly.subplots import make_subplots

from mdb.utils.plotting import style_figure


def add_etr_trace(fig, dat, idx):
    fig.add_trace(
        go.Bar(
            x=dat["datetime"],
            y=dat["Reference ET (a=0.23) [in]"],
            marker=dict(color="red"),
            name="ETr",
            hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Reference ET Total</b>: %{y}",
        ),
        # row=idx,
        # col=1,
    )
    return fig


def add_gdd_trace(fig, dat, idx):
    fig.add_trace(
        go.Scatter(
            x=dat["datetime"],
            y=dat["Cumulative GDDs [GDD °F]"],
            mode="lines+markers",
            line=dict(color="orange", width=2),
            name="GDDs",
            hovertemplate="<b>Date</b>: %{x}<br>"
            + "<b>Cumulative Degree Days</b>: %{y}",
        ),
        # row=idx,
        # col=1,
    )
    fig.update_layout(
        hovermode='x',
        xaxis=dict(
            showspikes = True,
            spikemode  = 'across+toaxis',
            spikesnap = 'cursor',
            showline=True,
            showgrid=True,
        ),
        spikedistance =  -1,
    )
    return fig


def add_feels_like_trace(fig, dat, idx):
    dat = dat.assign(
        index_used = np.where(~dat['Heat Index [°F]'].isna(), 'heat', 'temp'),
    )
    dat = dat.assign(
        index_used = np.where(~dat['Wind Chill [°F]'].isna(), 'chill', dat['index_used'])
    )
    col_map = {
        "chill": "blue", 
        "heat": "red",
        "temp": "green",
    }
    fig.add_trace(
        go.Scatter(
            x=dat["datetime"],
            y=dat["Feels Like Temperature [°F]"],
            mode="lines+markers",
            marker={
                "color": dat["index_used"].apply(lambda x: col_map[x]),
            },
            line=dict(color="black", width=1),
            name="Feels Like Temperature",
            hovertemplate="<b>Date</b>: %{x}<br>"
            + "<b>Feels Like Temperature</b>: %{y}",
        ),
        # row=idx,
        # col=1,
    )
    return fig


# Define a function to update the 'value' column based on conditions
def update_value(group):
    if "Soil Temperature" in group["variable"].values:
        soil_temp_value = group.loc[
            group["variable"] == "Soil Temperature", "value"
        ].values[0]
        if soil_temp_value <= 32:
            group.loc[group["variable"] == "Soil VWC", "value"] = np.nan
    return group


def plot_soil_heatmap(dat):
    dat = dat.melt(id_vars=["station", "datetime"])
    dat["variable"], dat["depth"] = dat["variable"].str.split("@", 1).str
    dat["variable"] = dat["variable"].str.strip()
    dat["depth"] = dat["depth"].str.replace(r"\[.*\]", "")
    dat["depth"] = dat["depth"].str.strip()

    out = dat.groupby(["depth", "station", "datetime"]).apply(update_value)
    out = out[out["variable"] == "Soil VWC"]
    ticks = (
        ((out["value"] / 10).round() * 10)
        .drop_duplicates()
        .dropna()
        .astype(int)
        .values.tolist()
    )
    if 0 not in ticks:
        ticks.append(0)

    labs = [str(x) + "%" for x in ticks]
    plt = go.Figure(
        go.Heatmap(
            x=out["datetime"],
            y=out["depth"],
            z=out["value"],
            colorscale="Viridis", 
            colorbar=dict(
                tickmode="array",
                tickvals=ticks, 
                ticktext=labs,
            ),
            zmin=0,
            zmax=max(out["value"]),
        )
    )
    plt = plt.update_layout(
        yaxis={
            "title": "Soil Depth",
            "categoryarray": ["-100 cm", "-50 cm", "-20 cm", "-10 cm", "-5 cm"],
        }
    )
    return plt


_match_case = {
    "etr": add_etr_trace,
    "gdd": add_gdd_trace,
    "feels_like": add_feels_like_trace,
}

_axis_labeller = {
    "etr": "<b>Reference ET<br>(a=0.23) [in]</b>",
    "gdd": "<b>Cumulative GDDs<br>[GDD °F]</b>",
    "feels_like": "<b>Feels Like Temperature<br>[°F]</b>",
}


def plot_derived(dat, selected):
    fig = go.Figure()
    print(selected)

    fig = _match_case[selected](fig, dat, 1)
    fig.update_yaxes(title_text=_axis_labeller[selected])

    x_ticks = [
        dat["datetime"].min() - rd(days=1),
        dat["datetime"].max() + rd(days=1),
    ]
    fig = style_figure(fig, x_ticks, legend=False)
    fig.update_layout(height=500)

    return fig
