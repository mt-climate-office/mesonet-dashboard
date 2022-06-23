import plotly.express as px

def plot_met(dat, **kwargs):

    variable_text = dat.columns.tolist()[-1]
    station_name = kwargs["station"]["station"].values[0]

    fig = px.line(dat, x="datetime", y=variable_text, markers=True)

    fig = fig.update_traces(line_color=kwargs["color"], connectgaps=False)

    variable_text = variable_text.replace("<br>", " ")

    fig.update_traces(
        hovertemplate="<b>Date</b>: %{x}<br>" + "<b>" + variable_text + "</b>: %{y}",
    )
    
    return fig
