BEGIN;

CREATE TABLE public.fields (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE public.project_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE public.project_fields (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  field_id INTEGER NOT NULL REFERENCES public.fields(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE (project_id, field_id)
);
CREATE INDEX project_fields_project_id_idx ON public.project_fields(project_id);
CREATE INDEX project_fields_field_id_idx ON public.project_fields(field_id);

CREATE TABLE public.project_categories (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE (project_id, category_id)
);
CREATE INDEX project_categories_project_id_idx ON public.project_categories(project_id);
CREATE INDEX project_categories_category_id_idx ON public.project_categories(category_id);

CREATE TABLE public.project_project_types (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  type_id INTEGER NOT NULL REFERENCES public.project_types(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE (project_id, type_id)
);
CREATE INDEX project_project_types_project_id_idx ON public.project_project_types(project_id);
CREATE INDEX project_project_types_type_id_idx ON public.project_project_types(type_id);

COMMIT;
