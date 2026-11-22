import { Fragment } from 'react';

const SUPERSCRIPT_RUN = /([⁰¹²³⁴⁵⁶⁷⁸⁹ᵃᵇᶜᵈᵉᶠ]+)/;
const PLAIN: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f',
};

/**
 * Zamienia znaki indeksu górnego z przepisów (art. 182¹ᵃ) na prawdziwy <sup>:
 * w Lato brakuje części tych glifów, więc przeglądarka podstawiała inną czcionkę i wyglądało to krzywo.
 */
export function SuperText({ text }: { text: string }) {
  return (
    <>
      {text.split(SUPERSCRIPT_RUN).map((part, index) =>
        index % 2 === 1 ? (
          <sup key={index} className="legal-sup">
            {[...part].map((char) => PLAIN[char] ?? char).join('')}
          </sup>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
