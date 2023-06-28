![MCO Logo](./app/mdb/assets/MCO_logo.svg)
# The Montana Mesonet Dashboard



This repository contains the code used to host the Montana Mesonet dashboard. The dashboard uses the [Dash](https://plotly.com/dash) library to create interactive graphs displaying up to two weeks of data for a given mesonet station. The dashboard calls the [Montana Mesonet API](https://mesonet.climate.umt.edu/api/v2/docs) to obtain the station data. 

The application can be launched with `Docker` using the following commands:

    docker build -t dash https://github.com/mt-climate-office/mesonet-dashboard.git#develop
    docker run -d --rm --name dash -p 80:80 dash

If you would like to make changes to the application or implement the dashboard for your own Mesonet, you can clone the repository using `git`:

    git clone https://github.com/mt-climate-office/mesonet-dashboard.git
    git checkout develop

Then, you can make modifications and host the application locally using `Docker`:

    docker build -t dash .
    docker run -d --rm --name dash -p 80:80 dash

After using the `docker run` command, the application can be viewed locally by going to http://localhost in your web browser. 