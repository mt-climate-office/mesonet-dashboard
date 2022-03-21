# The Montana Mesonet Dashboard

This repository contains the code used to host the Montana Mesonet dashboard. The dashboard uses the [Dash](https://plotly.com/dash) library to create interactive graphs displaying up to two weeks of data for a given mesonet station. The dashboard calls the [Montana Mesonet API](https://mesonet.climate.umt.edu/api/v2/docs) to obtain the station data. 

The application can be built and deployed locally using `git` and `Docker` with the following commands:

    git clone https://github.com/mt-climate-office/mesonet-dashboard.git
    git checkout develop
    docker build -t dash https://github.com/mt-climate-office/mesonet-dashboard.git#develop
    docker run -d --rm --name dash -p 80:80 dash

Then, the application can be viewed locally with by going to http://localhost in your web browser. 