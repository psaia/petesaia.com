package hello

import (
    "fmt"
    "net/http"
)

func init() {
    http.HandleFunc("/", handler)
}

const content = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>petesaia.com</title>
</head>
<body>
<ul>
<li><a target="_blank" href="https://twitter.com/petesaia">connect</a></li>
<li><a target="_blank" href="https://medium.com/@PS_/image-processing-go-microservice-df423d1b8ddd">write</a></li>
<li><a target="_blank" href="https://github.com/LevInteractive">work</a></li>
<li><a target="_blank" href="https://www.flickr.com/photos/petesaia">shoot</a></li>
</ul>
</body>
</html>
`

func handler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprint(w, content)
}
