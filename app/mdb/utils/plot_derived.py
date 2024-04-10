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
    "cci": "<b>Comprehensive Climate Index [degF]</b>",
}


def add_styling(fig, dat, selected, legend=False):
    fig.update_yaxes(title_text=_axis_labeller[selected])

    x_ticks = [
        dat["datetime"].min() - rd(days=1),
        dat["datetime"].max() + rd(days=1),
    ]
    fig = style_figure(fig, x_ticks, legend=legend)
    fig.update_layout(
        height=500,
        legend=dict(orientation="h"),
    )

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


_stage_colors = [
    "#a6cee3",
    "#1f78b4",
    "#b2df8a",
    "#33a02c",
    "#fb9a99",
    "#e31a1c",
    "#fdbf6f",
    "#ff7f00",
    "#cab2d6",
    "#6a3d9a",
    "#ffff99",
    "#b15928",
    "#8dd3c7",
    "#ffffb3",
    "#bebada",
    "#fb8072",
    "#80b1d3",
    "#fdb462",
    "#b3de69",
    "#fccde5",
    "#d9d9d9",
    "#bc80bd",
    "#ccebc5",
    "#ffed6f",
] * 2


def add_gdd_trace(dat):
    fig = go.Figure(
        go.Bar(
            x=dat["datetime"],
            y=dat["GDDs [GDD °F]"],
            marker=dict(color="orange"),
            name="Daily GDDs",
            hovertemplate="<b>Date</b>: %{x}<br>" + "<b>Daily GDDs</b>: %{y}",
        )
    )

    color_map = dict(zip(dat["Growth Stage"].drop_duplicates().values, _stage_colors))

    fig.add_trace(
        go.Scatter(
            x=dat["datetime"],
            y=dat["Cumulative GDDs [GDD °F]"],
            mode="lines+markers",
            marker={"color": dat["Growth Stage"].apply(lambda x: color_map[x])},
            customdata=dat["Growth Stage"],
            line=dict(color="orange", width=2),
            name="Cumulative GDDs",
            yaxis="y2",
            hovertemplate="<b>Date</b>: %{x}<br>"
            + "<b>Cumulative GDDs</b>: %{y}<br>"
            + "<b>Growth Stage</b>: %{customdata}",
        ),
        # row=idx,
        # col=1,
    )
    fig = add_styling(fig, dat, "gdd", True)

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
        legend=dict(orientation="h"),
        yaxis=dict(
            title=dict(text="<b>Daily GDDs [GDD °F]</b>"),
            side="left",
            range=[0, dat["GDDs [GDD °F]"].max()],
        ),
        yaxis2=dict(
            title=dict(text="<b>Cumulative GDDs [GDD °F]</b>"),
            side="right",
            overlaying="y",
            tickmode="sync",
            range=[0, dat["Cumulative GDDs [GDD °F]"].max()],
        ),
    )

    return fig


def classify_cci(value, newborn=False):
    if value >= 113:
        return "Extreme Danger"
    if value >= 105 and value < 113:
        return "Extreme"
    if value >= 96 and value < 105:
        return "Severe"
    if value >= 87 and value < 96:
        return "Moderate"
    if value >= 77 and value < 87:
        return "Mild"

    if newborn:
        if value >= 42 and value < 77:
            return "No Stress"
        if value >= 32 and value < 42:
            return "Mild"
        if value >= 23 and value < 32:
            return "Moderate"
        if value >= 14 and value < 23:
            return "Severe"
        if value >= 5 and value < 14:
            return "Extreme"
        if value < 5:
            return "Extreme Danger"
    else:
        if value >= 33 and value < 77:
            return "No Stress"
        if value >= 14 and value < 33:
            return "Mild"
        if value >= -4 and value < 14:
            return "Moderate"
        if value >= -22 and value < -4:
            return "Severe"
        if value >= -40 and value < -22:
            return "Extreme"
        if value < -40:
            return "Extreme Danger"

    raise ValueError(f"Value={value} Could not be classified correctly.")


def add_cci_trace(dat, newborn=False):
    dat["Livestock Risk"] = dat["Comprehensive Climate Index [°F]"].apply(
        lambda x: classify_cci(x, newborn=newborn)
    )
    fig = px.scatter(
        dat,
        x="datetime",
        y="Comprehensive Climate Index [°F]",
        color="Livestock Risk",
        color_discrete_map={
            "Extreme Danger": "#843094",
            "Extreme": "#CC0606",
            "Severe": "#FF4400",
            "Moderate": "#FFAD00",
            "Mild": "#FFFF00",
            "No Stress": "#A5A5A5",
        },
    ).add_trace(
        go.Line(
            x=dat["datetime"],
            y=dat["Comprehensive Climate Index [°F]"],
            mode="lines",
            line=dict(color="#000000"),
            showlegend=False,
        )
    )

    # Reverse trace order so black line is on the bottom
    fig.data = fig.data[::-1]

    fig = add_styling(fig, dat, "cci", True)
    fig.update_layout(xaxis_title="")
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
    # Strip metadata columns about whether values had to be clipped.
    dat = dat.iloc[:, ~dat.columns.str.contains("Clipped")]
    out = dat.melt(id_vars=["station", "datetime"])
    out["variable"], out["depth"] = out["variable"].str.split("@", 1).str
    out = out[~out["variable"].str.contains("Clipped")]
    out["variable"] = out["variable"].str.strip()
    out["depth"] = out["depth"].str.replace(r"\[.*\]", "")
    out["depth"] = out["depth"].str.strip()

    if variable != "soil_temp":
        out = out.groupby(["depth", "station", "datetime"]).apply(update_value)

    if variable == "soil_vwc":
        out = out[out["variable"] == "Soil VWC"]
    elif variable == "soil_temp":
        out = out[out["variable"] == "Soil Temperature"]
    elif variable == "swp":
        out = out[out["variable"] == "Soil Water Potential"]
    else:
        out = out[out["variable"] == "Bulk EC"]

    out = out.assign(value=out["value"].astype(float))
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
        "swp": "Soil Water Potential [negative kPa]",
    }

    color_map = {
        "soil_temp": px.colors.diverging.RdBu_r,
        "swp": px.colors.diverging.BrBG_r
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
    ys = sorted(ys, key=lambda x: int(x.split(" ")[0]))
    out = out.drop(columns="datetime")[ys].T.values
    fig = px.imshow(
        out,
        aspect="auto",
        y=ys,
        x=xs,
        labels=dict(color=lab_map[variable]),
        color_continuous_scale=color_map.get(variable, px.colors.diverging.BrBG),
        color_continuous_midpoint=32 if variable == "soil_temp" else (mn + mx) / 2,
    )

    return fig


def plot_swp(dat):
    cols = dat.columns[1:].tolist()
    y_cols = [x for x in cols if "Potential" in x]
    dat["mx"] = 1500
    dat["mn"] = 33

    # clipped_cols = [x for x in cols if "Clipped" in x]

    fig = px.line(
        dat,
        x="datetime",
        y=y_cols,
        color_discrete_map={
            "Soil Water Potential @ 2 in [kPa]": "#636efa",
            "Soil Water Potential @ 4 in [kPa]": "#EF553B",
            "Soil Water Potential @ 8 in [kPa]": "#00cc96",
            "Soil Water Potential @ 20 in [kPa]": "#ab63fa",
            "Soil Water Potential @ 28 in [kPa]": "#FFA15A",
            "Soil Water Potential @ 36 in [kPa]": "#FFA15A",
            "Soil Water Potential @ 40 in [kPa]": "#301934",
        },
    )

    fig.update_layout(
        yaxis_title="Soil Water Potential [Negative kPa]",
        yaxis_type="log",  # Set the y-axis to log scale
    )
    max_all = dat[y_cols].max().max()
    top_line = go.Scatter(
        x=dat["datetime"],
        y=[max_all] * len(dat["datetime"]),
        mode="lines",
        line={"dash": "dash", "color": "rgba(255, 0, 0, 1)"},
        fillcolor="rgba(255, 0, 0, 0.2)",
        showlegend=True,
        fill="tonexty",
        name="Wilting Point",
        hovertext="Water Not Plant Available",
        stackgroup="one",  # define stack group
    )
    mx_line = go.Scatter(
        x=dat.datetime,
        y=dat.mx,
        mode="lines",
        line={"dash": "dash", "color": "rgba(2, 75, 48, 1)"},
        fillcolor="rgba(2, 75, 48, 0.2)",
        showlegend=True,
        name="Plant Available Water",
        hovertext="Water Is Plant Available",
        stackgroup="one",  # define stack group
    )

    mn_line = go.Scatter(
        x=dat.datetime,
        y=dat.mn,
        mode="lines",
        line={"dash": "dash", "color": "rgba(135, 206, 250, 1)"},
        fillcolor="rgba(135, 206, 250, 0.2)",
        showlegend=True,
        name="Field Capacity",
        fill="tozeroy",
        hovertext="Soil Is Saturated",
        stackgroup="one",  # define stack group
    )

    fig.add_trace(mn_line)
    fig.add_trace(mx_line)
    fig.add_trace(top_line)
    fig = style_figure(fig, legend=True)
    fig.update_layout(
        xaxis=dict(title_text=""),
        legend=dict(title_text=""),
    )

    return fig


def plot_derived(dat, selected, soil_var=None, newborn=False):

    if selected == "etr":
        return add_etr_trace(dat)
    elif selected == "gdd":
        return add_gdd_trace(dat)
    elif selected == "feels_like":
        return add_feels_like_trace(dat)
    elif selected == "cci":
        return add_cci_trace(dat, newborn)
    elif selected == "swp":
        return plot_swp(dat)
    else:
        return plot_soil_heatmap(dat, soil_var)
