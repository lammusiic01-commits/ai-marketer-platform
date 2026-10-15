# Amvera deployment notes

- Official quick start: https://docs.amvera.ru/applications/quick-start.html
- Official build docs: https://docs.amvera.ru/applications/build.html
- Official storage docs: https://docs.amvera.ru/applications/storage.html
- Amvera requires `amvera.yaml` in the Code root; `amvera.yml` is not the documented filename.
- Python build requires `requirements.txt`.
- Persistent Data is mounted at the path configured by `run.persistenceMount`, normally `/data`; runtime data such as SQLite must use an absolute path such as `/data/data.db`.
- Quick start says the dashboard is `https://cloud.amvera.ru/`, create project -> Application -> upload files through the interface or use git, configure variables, finish/build.
- Current dashboard warning says Moscow_0 is temporarily unavailable; user explicitly instructed not to select Moscow. Warsaw-0 is being selected instead when available.
