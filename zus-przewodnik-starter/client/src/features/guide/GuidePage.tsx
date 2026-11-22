import { Link, useParams } from 'react-router-dom';
import { AppBar } from '../../components/AppBar';
import { AppFooter, type FooterLink } from '../../components/AppFooter';
import {
  ArrowIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CoinIcon,
  HelpIcon,
  LifebuoyIcon,
} from '../../components/icons';
import { SituationIcon } from '../landing/SituationIcon';
import { articles } from './articles';
import './GuidePage.css';

const FOOTER_LINKS: FooterLink[] = [
  { to: '/', label: 'Strona startowa' },
  { to: '/cases', label: 'Przykładowe sprawy' },
];

/** Każdy temat ma własną ikonę – łatwiej odróżnić go na liście niż po samym tytule. */
function TopicIcon({ slug, situation }: { slug: string; situation: (typeof articles)[number]['situation'] }) {
  switch (slug) {
    case 'macierzynski':
      return <CoinIcon />;
    case 'rodzicielski':
      return <CalendarIcon />;
    case 'ojcowski':
      return <ClockIcon />;
    case 'trudne-sytuacje':
      return <LifebuoyIcon />;
    case 'faq':
      return <HelpIcon />;
    default:
      return <SituationIcon situation={situation} />;
  }
}

export function GuidePage() {
  const { slug } = useParams();
  const article = articles.find((item) => item.slug === slug);

  return (
    <div className="guide-page">
      <header>
        <AppBar
          actions={
            <Link to="/" className="ui-btn ui-btn--cta ui-btn--sm">
              Zacznij plan
            </Link>
          }
        />
      </header>
      <main id="main" tabIndex={-1} className="ui-container guide-page__main">
        <nav className="guide-page__nav" aria-label="Nawigacja przewodnika">
          <Link to="/">Strona główna</Link>
          {slug && (
            <>
              <span aria-hidden="true">›</span>
              <Link to="/guide">Wszystkie tematy</Link>
            </>
          )}
        </nav>
        {article ? (
          <article className="guide-article">
            <header className="guide-article__head">
              <span className="guide-article__icon">
                <TopicIcon slug={article.slug} situation={article.situation} />
              </span>
              <h1>{article.title}</h1>
              <p className="guide-article__lead">{article.summary}</p>
            </header>
            <div className="guide-steps">
              {article.sections.map((section, index) => (
                <section
                  key={section.title}
                  className="guide-card"
                  data-reveal
                  style={{ ['--i' as string]: 0 }}
                >
                  <span className="guide-card__num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h2>{section.title}</h2>
                  <p>{section.content}</p>
                </section>
              ))}
            </div>
            <section className="guide-prepare" data-reveal>
              <h2>Co przygotować do obliczeń</h2>
              <ul className="guide-checklist">
                {article.prepare.map((item) => (
                  <li key={item}>
                    <CheckIcon className="guide-checklist__icon" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="guide-actions">
                <Link
                  className="ui-btn ui-btn--cta ui-btn--lg guide-cta"
                  to={`/wizard?situation=${article.situation}`}
                >
                  Policz dla siebie <ArrowIcon />
                </Link>
                {article.support && (
                  <Link className="ui-btn ui-btn--ghost" to="/plan/support?situation=afterBirth">
                    Przejdź do wsparcia
                  </Link>
                )}
              </div>
            </section>
            <section className="guide-sources" data-reveal>
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
          <div className="guide-card guide-article guide-article--missing">
            <h1>Nie znaleziono tematu</h1>
            <p>
              Wybierz temat z <Link to="/guide">przewodnika</Link>.
            </p>
          </div>
        ) : (
          <>
            <header className="guide-hero">
              <p className="ui-eyebrow ui-rise">Przewodnik</p>
              <h1 className="ui-rise" style={{ ['--i' as string]: 1 }}>
                Przewodnik dla rodziców
              </h1>
              <p className="guide-hero__lead ui-rise" style={{ ['--i' as string]: 2 }}>
                Wybierz temat, aby sprawdzić zasady i dowiedzieć się, jakie dane przygotować.
              </p>
            </header>
            <ul className="guide-topics">
              {articles.map((item, index) => (
                <li
                  key={item.slug}
                  className="guide-topic ui-rise"
                  style={{ ['--i' as string]: Math.min(index, 7) + 2 }}
                >
                  <span className="guide-topic__icon">
                    <TopicIcon slug={item.slug} situation={item.situation} />
                  </span>
                  <h2>
                    <Link className="guide-topic__link" to={`/guide/${item.slug}`}>
                      {item.title}
                    </Link>
                  </h2>
                  <p>{item.summary}</p>
                  <span className="guide-topic__more" aria-hidden="true">
                    Czytaj <ArrowIcon />
                  </span>
                </li>
              ))}
            </ul>
            <aside className="guide-start" data-reveal>
              <div>
                <h2>Nie wiesz, od czego zacząć?</h2>
                <p>Odpowiedz na kilka krótkich pytań – pokażemy, co Ci przysługuje i co załatwić.</p>
              </div>
              <Link className="ui-btn ui-btn--cta" to="/">
                Zacznij od swojej sytuacji <ArrowIcon />
              </Link>
            </aside>
          </>
        )}
      </main>
      <AppFooter links={FOOTER_LINKS} />
    </div>
  );
}
