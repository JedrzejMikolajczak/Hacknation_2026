import { Link, useParams } from 'react-router-dom';
import { articles } from './articles';
import './GuidePage.css';

export function GuidePage() {
  const { slug } = useParams();
  const article = articles.find((item) => item.slug === slug);

  return (
    <main className="guide-page">
      <nav className="guide-page__nav" aria-label="Nawigacja przewodnika">
        <Link to="/">Strona główna</Link>
        {slug && <Link to="/guide">Wszystkie tematy</Link>}
      </nav>
      {article ? (
        <article className="guide-article">
          <header>
            <h1>{article.title}</h1>
            <p>{article.summary}</p>
          </header>
          {article.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.content}</p>
            </section>
          ))}
          <section className="guide-prepare">
            <h2>Co przygotować do obliczeń</h2>
            <ul>
              {article.prepare.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="guide-actions">
              <Link className="guide-cta" to={`/wizard?situation=${article.situation}`}>
                Policz dla siebie
              </Link>
              {article.support && (
                <Link to="/plan/support?situation=afterBirth">Przejdź do wsparcia</Link>
              )}
            </div>
          </section>
          <section>
            <h2>Źródła</h2>
            <ul>
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url}>{source.title}</a>
                </li>
              ))}
            </ul>
          </section>
        </article>
      ) : slug ? (
        <div className="guide-article">
          <h1>Nie znaleziono tematu</h1>
          <p>
            Wybierz temat z <Link to="/guide">przewodnika</Link>.
          </p>
        </div>
      ) : (
        <>
          <header className="guide-heading">
            <h1>Przewodnik dla rodziców</h1>
            <p>Wybierz temat, aby sprawdzić zasady i dowiedzieć się, jakie dane przygotować.</p>
          </header>
          <ul className="guide-topics">
            {articles.map((item) => (
              <li key={item.slug} className="guide-topic">
                <h2>
                  <Link to={`/guide/${item.slug}`}>{item.title}</Link>
                </h2>
                <p>{item.summary}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
