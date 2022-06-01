import React from "react";
import ReactDOMServer from "react-dom/server";
import type { Entry, JsonReport } from "./conflate";

const TitleCol: React.FC<{ e: Entry }> = ({ e }) => (
  <>
    {e.base.name} (
    <a
      href={`https://osm.org/${e.osm[0]}/${e.osm[1]}`}
      target="_blank"
      rel="noreferrer"
    >
      OSM
    </a>
    {" | "}
    <a
      href={`https://wikidata.org/wiki/${e.q}`}
      target="_blank"
      rel="noreferrer"
    >
      Q
    </a>
    )
  </>
);

const PopCol: React.FC<{ base?: string; change?: string }> = ({
  base,
  change,
}) => {
  if (base && change) {
    const diff = +change - +base;
    return (
      <span className="yellow">
        {change} ({diff > 0 ? "+" : ""}
        {diff})
      </span>
    );
  }

  if (change) return <span className="green">{change}</span>;
  if (base) return <>{base}</>; // eslint-disable-line react/jsx-no-useless-fragment

  return <>???</>;
};

const WikipediaCol: React.FC<{ base?: string; change?: string }> = ({
  base,
  change,
}) => {
  if (base && change) {
    return (
      <a className="yellow" href={`https://en.wikipedia.org/wiki/${change}`}>
        {change} (<span className="strike">{base}</span>)
      </a>
    );
  }

  if (change) {
    return (
      <a className="green" href={`https://en.wikipedia.org/wiki/${change}`}>
        {change}
      </a>
    );
  }

  if (base) {
    return <a href={`https://en.wikipedia.org/wiki/${base}`}>{base}</a>;
  }

  return null;
};

const GenericDiffCol: React.FC<{ base?: string; change?: string }> = ({
  base,
  change,
}) => {
  if (base && change) {
    return (
      <span className="yellow">
        {change} (<span className="strike">{base}</span>)
      </span>
    );
  }

  if (change) return <span className="green">{change}</span>;
  if (base) return <>{base}</>; // eslint-disable-line react/jsx-no-useless-fragment

  return null;
};

const css = `
  body {
    margin: 8px;
    background: #333;
    color: #fff;
    font-family: sans-serif;
  }
  a { color: #1e90ff; }
  .red, .yellow, .green {
    color: #000;
    text-decoration: none;
    border-radius: 4px;
    padding: 3px;
    display: inline-block;
  }
  .red { background-color: #f00; color: #fff; }
  .yellow { background-color: #ff0; color: #000;  }
  .green { background-color: #1e9; color: #000; }
  .strike { text-decoration: line-through; }
`;

const Report: React.FC<{ data: JsonReport }> = ({ data }) => {
  return (
    <html lang="en">
      <head>
        <title>OSM Population Report</title>
        <style>{css}</style>
      </head>
      <body>
        <h1>Errors ({data.error.length})</h1>
        <table>
          <thead>
            <tr>
              <td>Name</td>
              <td>Error</td>
            </tr>
          </thead>
          <tbody>
            {data.error.map((e) => (
              <tr key={e.q}>
                <td>
                  <TitleCol e={e} />
                </td>
                <td>{e.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h1>Features ({data.interesting.length})</h1>
        <table>
          <thead>
            <tr>
              <td>Name</td>
              <td>Pop</td>
              <td>Pop Source</td>
              <td>Pop Date</td>
              <td>Wikipedia</td>
            </tr>
          </thead>
          <tbody>
            {data.interesting.map((e) => (
              <tr key={e.q}>
                <td>
                  <TitleCol e={e} />
                </td>
                <td>
                  <PopCol base={e.base?.pop} change={e.changes?.pop} />
                </td>
                <td>
                  <GenericDiffCol
                    base={e.base.popSrc}
                    change={e.changes?.popSrc}
                  />
                </td>
                <td>
                  <GenericDiffCol
                    base={e.base.popDate}
                    change={e.changes?.popDate}
                  />
                </td>
                <td>
                  <WikipediaCol base={e.base?.wp} change={e.changes?.wp} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h1>Other</h1>
        {data.boring.length} places were hidden because they either have no
        Wikipedia page, or the Wikipedia page has no population.
      </body>
    </html>
  );
};

export function generateReport(data: JsonReport): string {
  const html = ReactDOMServer.renderToStaticMarkup(<Report data={data} />);

  return `<!doctype html yeet>${html}`;
}
