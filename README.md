# Version 2 of the Montana Mesonet Dashboard
## Dynamically Plots Data from the Mesonet APIv2

CSS Styling and some implementation borrowed from [this](https://github.com/plotly/dash-sample-apps/tree/main/apps/dash-manufacture-spc-dashboard) Dash example.

Can be run with Docker:

    docker build -t mesonet_dash .
    docker run -p 8080:80 mesonet_dash