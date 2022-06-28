import plotly.express as px

def plot_indicator(dat, **kwargs):

    fig = px.line(
        dat,
        x="date",
        y="value",
        color="platform",
    )

    fig.update_traces(
        connectgaps=False,
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>"+kwargs['element']+"</b>: %{y}",
    )

    fig.update_layout(
        hovermode="x unified",
    )

def plot_dual_inidcator():
    pass