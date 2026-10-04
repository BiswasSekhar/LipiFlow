//! Offline Mozhi 2 conversion. The reference is interpreted as data, never code.
use serde::Deserialize;
mod legacy;
pub use legacy::{Encoded, MAP_VERSION, encode_legacy};
use std::{collections::BTreeMap, sync::OnceLock};

pub const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const SCHEME_VERSION: &str = "mozhi-2/1.0.0 (reference 3.2.6)";

#[derive(Clone, Deserialize)]
struct Rule {
    c: Vec<i32>,
    k: i32,
    o: Vec<i32>,
}

#[derive(Deserialize)]
struct Data {
    ranges: Vec<Vec<i32>>,
    rules: Vec<Rule>,
}

struct Engine {
    ranges: Vec<Vec<i32>>,
    by_key: BTreeMap<i32, Vec<Rule>>,
}

impl Engine {
    fn new() -> Self {
        let data: Data = serde_json::from_str(include_str!("../../../data/mozhi/mozhi-2.v1.json"))
            .expect("validated, bundled Mozhi data");
        let mut by_key: BTreeMap<i32, Vec<Rule>> = BTreeMap::new();
        for rule in data.rules {
            if rule.k <= -1000 {
                for key in &data.ranges[(-1000 - rule.k) as usize] {
                    by_key.entry(*key).or_default().push(rule.clone());
                }
            } else {
                by_key.entry(rule.k).or_default().push(rule);
            }
        }
        Self {
            ranges: data.ranges,
            by_key,
        }
    }

    fn matches(&self, pattern: i32, actual: i32) -> bool {
        if pattern <= -1000 {
            self.ranges[(-1000 - pattern) as usize].contains(&actual)
        } else {
            pattern == actual
        }
    }

    fn type_key(&self, history: &mut Vec<i32>, key: i32) {
        if let Some(rules) = self.by_key.get(&key) {
            for rule in rules {
                if rule.c.len() > history.len() {
                    continue;
                }
                let start = history.len() - rule.c.len();
                if !rule
                    .c
                    .iter()
                    .zip(&history[start..])
                    .all(|(&p, &a)| self.matches(p, a))
                {
                    continue;
                }
                let context = history[start..].to_vec();
                history.truncate(start);
                for &op in &rule.o {
                    if op == -2000 {
                        history.extend_from_slice(&context);
                    } else if op <= -3000 {
                        let encoded = -3000 - op;
                        let range = (encoded / 100) as usize;
                        let position = (encoded % 100 - 1) as usize;
                        let (pattern, actual) = if position < context.len() {
                            (rule.c[position], context[position])
                        } else {
                            (rule.k, key)
                        };
                        let source_range = (-1000 - pattern) as usize;
                        let index = self.ranges[source_range]
                            .iter()
                            .position(|&c| c == actual)
                            .expect("index references a matched store");
                        history.push(self.ranges[range][index]);
                    } else {
                        history.push(op);
                    }
                }
                return;
            }
        }
        history.push(key);
    }
}

fn flush(history: &mut Vec<i32>, output: &mut String) {
    output.extend(
        history
            .drain(..)
            .filter_map(|cp| u32::try_from(cp).ok().and_then(char::from_u32)),
    );
}

/// Replaying the full source makes edits and undo deterministic on every platform.
/// Non-ASCII source text is a context boundary and is preserved byte for byte.
/// `{literal text}` is a LipiFlow convenience; unmatched braces remain literal.
pub fn transliterate(text: &str) -> String {
    static ENGINE: OnceLock<Engine> = OnceLock::new();
    let engine = ENGINE.get_or_init(Engine::new);
    let mut output = String::with_capacity(text.len());
    let mut history = Vec::new();
    let mut chars = text.char_indices().peekable();
    while let Some((offset, ch)) = chars.next() {
        if ch == '{' {
            flush(&mut history, &mut output);
            if let Some(end) = text[offset + 1..].find('}') {
                let closing = offset + 1 + end;
                output.push_str(&text[offset + 1..closing]);
                while chars.peek().is_some_and(|&(i, _)| i <= closing) {
                    chars.next();
                }
            } else {
                output.push_str(&text[offset..]);
                return output;
            }
        } else if !ch.is_ascii() {
            flush(&mut history, &mut output);
            output.push(ch);
        } else {
            engine.type_key(&mut history, ch as i32);
        }
    }
    flush(&mut history, &mut output);
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    #[derive(Deserialize)]
    struct Example {
        input: String,
        output: String,
    }

    #[test]
    fn published_examples_and_boundaries() {
        let cases: Vec<Example> =
            serde_json::from_str(include_str!("../../../data/golden-tests/mozhi-2.json")).unwrap();
        let failures: Vec<_> = cases
            .into_iter()
            .filter_map(|case| {
                let actual = transliterate(&case.input);
                (actual != case.output).then(|| {
                    format!(
                        "{:?}: expected {:?}, got {:?}",
                        case.input, case.output, actual
                    )
                })
            })
            .collect();
        assert!(failures.is_empty(), "{}", failures.join("\n"));
    }

    #[test]
    fn incomplete_words_follow_mozhi_composition() {
        for (source, expected) in [
            ("n", "ൻ"),
            ("nj", "ഞ്"),
            ("nja", "ഞ"),
            ("njaa", "ഞാ"),
            ("njaan", "ഞാൻ"),
        ] {
            assert_eq!(transliterate(source), expected);
        }
    }

    #[test]
    fn long_text_retains_every_line() {
        let source = "namaskaaram 😀\n".repeat(1000);
        assert_eq!(transliterate(&source), "നമസ്കാരം 😀\n".repeat(1000));
    }
}
