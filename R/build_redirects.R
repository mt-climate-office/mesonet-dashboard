library(magrittr)

build_redirects <- function(f_dir="/home/zhoylman/mesonet-dashboard/data/station_page") {
  
  to_move <- list.files(f_dir, full.names = T, pattern = ".html")
  new_dir <- file.path(f_dir, "backups")
  
  if(!dir.exists(new_dir)) {
    dir.create(new_dir)  
  }
  d <- stringr::str_replace_all(lubridate::today(), "-", "")
  file.rename(
    to_move, 
    file.path(new_dir, paste0(d, "_", basename(to_move)))
  )
  
  base_url = "https://mesonet.climate.umt.edu/dash/"
  lapply(to_move, function(x) {
    fileConn<-file(x)
    station <- basename(x) %>% stringr::str_replace(".html", "")
    new_url <- glue::glue("{base_url}{station}/")
    text = glue::glue("
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv=\"refresh\" content=\"7; url='{new_url}'\" />
        </head>
        <body>
          <p>We have updated the Mesonet Dashboard!</p>
          <p>You should be redirected in the next 5 to 10 seconds. If you are not, please access the new dashboard <a href=\"{new_url}\">with this link</a>!</p>
        </body>
      </html>
      "
    )
    writeLines(text, fileConn)
    close(fileConn)  
  })
}

build_redirects()