import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from dateutil.relativedelta import relativedelta as rd

from mdb.utils.plotting import style_figure

_axis_labeller = {
    "etr": "<b>Reference ET<br>(a=0.23) [in]</b>",
    "gdd": "<b>Cumulative GDDs<br>[GDD °F]</b>",
    "feels_like": "<b>Feels Like Temperature<br>[°F]</b>",
    "soil_vwc,soil_temp,soil_ec_blk": "<b>Soil Depth [cm]</b>",
}


def add_styling(fig, dat, selected, legend=False):
    fig.update_yaxes(title_text=_axis_labeller[selected])

    x_ticks = [
        dat["datetime"].min() - rd(days=1),
        dat["datetime"].max() + rd(days=1),
    ]
    fig = style_figure(fig, x_ticks, legend=legend)
    fig.update_layout(height=500)
    return fig


def add_etr_trace(dat):
    dat = dat.sort_values("datetime")
    dat["et_cumulative"] = dat["Reference ET (a=0.23) [in]"].cumsum()

    fig = go.Figure(
        go.Bar(
            x=dat["datetime"],
            y=dat["Reference ET (a=0.23) [in]"],
            marker=dict(color="red"),
            name="ETr",
            hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Reference ET Total</b>: %{y}",
        ),
    )
    fig.add_trace(
        go.Scatter(
            x=dat["datetime"],
            y=dat["et_cumulative"],
            yaxis="y2",
            name="Cumulative ETr",
            hovertemplate="<b>Date</b>: %{x}<br>"
            + "<b>Cumulative Reference ET</b>: %{y}",
        ),
    )
    fig = add_styling(fig, dat, "etr", True)
    fig.update_layout(
        legend=dict(orientation="h"),
        yaxis=dict(
            title=dict(text="<b>Reference ET<br>(a=0.23) [in]</b>"),
            side="left",
            range=[0, dat["Reference ET (a=0.23) [in]"].max()],
        ),
        yaxis2=dict(
            title=dict(text="<b>Cumulative Reference ET<br>(a=0.23) [in]</b>"),
            side="right",
            overlaying="y",
            tickmode="sync",
            range=[0, dat["et_cumulative"].max()],
        ),
    )
    return fig


def add_gdd_trace(dat):
    fig = go.Figure()
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
        hovermode="x",
        xaxis=dict(
            showspikes=True,
            spikemode="across+toaxis",
            spikesnap="cursor",
            showline=True,
            showgrid=True,
        ),
        spikedistance=-1,
    )
    fig = add_styling(fig, dat, "gdd", False)

    return fig


def add_feels_like_trace(dat):
    dat = dat.assign(
        index_used=np.where(
            ~dat["Heat Index [°F]"].isna(), "Heat Index", "Average Temperature"
        ),
    )
    dat = dat.assign(
        index_used=np.where(
            ~dat["Wind Chill [°F]"].isna(), "Wind Chill", dat["index_used"]
        )
    )
    dat = dat.rename(columns={"index_used": "Index Used"})

    fig = px.scatter(
        dat,
        x="datetime",
        y="Feels Like Temperature [°F]",
        color="Index Used",
        color_discrete_map={
            "Wind Chill": "blue",
            "Heat Index": "red",
            "Average Temperature": "green",
        },
        labels={"feels_like": "Feels Like", "datetime": "Datetime"},
    ).add_trace(
        go.Line(
            x=dat["datetime"],
            y=dat["Feels Like Temperature [°F]"],
            mode="lines",
            line=dict(color="#000000"),
            showlegend=False,
        )
    )

    # Reverse trace order so black line is on the bottom
    fig.data = fig.data[::-1]

    fig = add_styling(fig, dat, "feels_like", True)

    return go.Figure(fig)


# Define a function to update the 'value' column based on conditions
def update_value(group):
    if "Soil Temperature" in group["variable"].values:
        soil_temp_value = group.loc[
            group["variable"] == "Soil Temperature", "value"
        ].values[0]
        if soil_temp_value <= 32:
            group.loc[
                group["variable"].str.contains("Soil VWC|Bulk EC"), "value"
            ] = np.nan
    return group


def plot_soil_heatmap(dat, variable):
    out = dat.melt(id_vars=["station", "datetime"])
    out["variable"], out["depth"] = out["variable"].str.split("@", 1).str
    out["variable"] = out["variable"].str.strip()
    out["depth"] = out["depth"].str.replace(r"\[.*\]", "")
    out["depth"] = out["depth"].str.strip()

    if variable != "soil_temp":
        out = out.groupby(["depth", "station", "datetime"]).apply(update_value)

    if variable == "soil_vwc":
        out = out[out["variable"] == "Soil VWC"]
    elif variable == "soil_temp":
        out = out[out["variable"] == "Soil Temperature"]
    else:
        out = out[out["variable"] == "Bulk EC"]

    if variable != "soil_blk_ec":
        ticks = (out["value"] / 10).round() * 10
    else:
        ticks = out["value"].round(1)

    ticks = (
        ticks.drop_duplicates()
        .dropna()
        .astype(int if variable != "soil_blk_ec" else float)
        .values.tolist()
    )
    # if 0 not in ticks and variable != "soil_temp":
    #     ticks.append(0)

    lab_map = {
        "soil_vwc": "Soil VWC [%]",
        "soil_temp": "Soil Temperature [degF]",
        "soil_blk_ec": "Soil Electrical Conductivity [mS/cm]",
    }

    mn = min(out["value"])
    mx = max(out["value"])

    out = out[["datetime", "depth", "value"]]
    out = (
        out.pivot(index="datetime", columns="depth", values="value")
        .reset_index()
        .rename_axis(None, axis=1)
    )
    out = out.sort_values("datetime")
    xs = out["datetime"]
    ys = [x for x in out.columns if x != "datetime"]
    ys = sorted(ys, key=lambda x: int(x.split(" ")[0]))[::-1]
    out = out.drop(columns="datetime")[ys].T.values
    fig = px.imshow(
        out,
        aspect="auto",
        y=ys,
        x=xs,
        labels=dict(color=lab_map[variable]),
        color_continuous_scale=px.colors.diverging.RdBu_r
        if variable == "soil_temp"
        else px.colors.sequential.Viridis,
        color_continuous_midpoint=32 if variable == "soil_temp" else (mn / mx) / 2,
    )

    return fig


_match_case = {
    "etr": add_etr_trace,
    "gdd": add_gdd_trace,
    "feels_like": add_feels_like_trace,
    "soil_vwc,soil_temp,soil_ec_blk": plot_soil_heatmap,
}


def plot_derived(dat, selected, soil_var=None):

    if selected == "etr":
        return add_etr_trace(dat)
    elif selected == "gdd":
        return add_gdd_trace(dat)
    elif selected == "feels_like":
        return add_feels_like_trace(dat)
    else:
        return plot_soil_heatmap(dat, soil_var)
