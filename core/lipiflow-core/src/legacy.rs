//! Unicode to the Windows character positions used by Karthika legacy fonts.
//! Mapping data: Aslam Ahammed, MIT. Never run replacements on already encoded text.
use serde::Serialize;
use std::sync::OnceLock;

pub const MAP_VERSION: &str = "karthika/1.0.0";

#[derive(Debug, Serialize)]
pub struct Encoded {
    pub text: String,
    pub unsupported: Vec<String>,
    pub map_version: &'static str,
    pub spans: Vec<EncodingSpan>,
}

/// UTF-16 offsets for editing a rendered legacy projection in browser controls.
#[derive(Debug, Serialize)]
pub struct EncodingSpan {
    pub unicode_start: usize,
    pub unicode_end: usize,
    pub encoded_start: usize,
    pub encoded_end: usize,
}

fn rules() -> &'static Vec<(String, String)> {
    static RULES: OnceLock<Vec<(String, String)>> = OnceLock::new();
    RULES.get_or_init(|| {
        let mut result = Vec::new();
        for line in include_str!("../../../data/legacy/karthika.v1.map").lines() {
            if line.starts_with('#') {
                continue;
            }
            if let Some((encoded, unicode)) = line.split_once('=')
                && unicode
                    .chars()
                    .any(|c| ('\u{0d00}'..='\u{0d7f}').contains(&c))
            {
                // Later aliases take precedence, as in the published map.
                result.retain(|(key, _)| key != unicode);
                result.push((unicode.to_owned(), encoded.to_owned()));
            }
        }
        result.sort_by_key(|(key, _)| std::cmp::Reverse(key.len()));
        result
    })
}

fn consonant(c: char) -> bool {
    ('\u{0d15}'..='\u{0d3a}').contains(&c)
}

fn mapped(text: &str, unsupported: &mut Vec<String>, report_joiners: bool) -> String {
    let mut output = String::new();
    let mut remaining = text;
    while !remaining.is_empty() {
        if let Some((key, value)) = rules().iter().find(|(key, _)| remaining.starts_with(key)) {
            // The published map assigns മ്ല to U+0178, which neither checked
            // Windows Karthika font contains. Preserve it and block exports.
            if value.contains('Ÿ') {
                output.push_str(key);
                if !unsupported.contains(key) {
                    unsupported.push(key.clone());
                }
            } else if key == "്ര" {
                output.insert_str(0, value);
            } else {
                output.push_str(value);
            }
            remaining = &remaining[key.len()..];
        } else {
            let c = remaining.chars().next().unwrap();
            output.push(c);
            if ('\u{0d00}'..='\u{0d7f}').contains(&c)
                || (report_joiners && matches!(c, '\u{200c}' | '\u{200d}'))
            {
                let item = c.to_string();
                if !unsupported.contains(&item) {
                    unsupported.push(item);
                }
            }
            remaining = &remaining[c.len_utf8()..];
        }
    }
    output
}

/// Keeps unrelated text intact. Unsupported Malayalam is returned unchanged and
/// reported so callers can disable legacy exports rather than silently lose text.
pub fn encode_legacy(text: &str) -> Encoded {
    let original: Vec<char> = text.chars().collect();
    let mut chars = Vec::new();
    let mut positions = Vec::new();
    let mut offset = 0;
    let mut index = 0;
    while index < original.len() {
        let start = offset;
        let combined = match (original[index], original.get(index + 1)) {
            ('െ', Some('ാ')) => Some('ൊ'),
            ('േ', Some('ാ')) => Some('ോ'),
            ('െ', Some('ൗ')) => Some('ൌ'),
            _ => None,
        };
        offset += original[index].len_utf16();
        if let Some(c) = combined {
            offset += original[index + 1].len_utf16();
            chars.push(c);
            index += 2;
        } else {
            chars.push(original[index]);
            index += 1;
        }
        positions.push((start, offset));
    }
    let mut result = Encoded {
        text: String::new(),
        unsupported: vec![],
        map_version: MAP_VERSION,
        spans: vec![],
    };
    let mut i = 0;
    let mut encoded_offset = 0;
    while i < chars.len() {
        let input_start = i;
        let output_start = result.text.len();
        if consonant(chars[i]) {
            let start = i;
            i += 1;
            // An orthographic cluster extends through explicit virama + consonant.
            while i + 1 < chars.len() && chars[i] == '്' && consonant(chars[i + 1]) {
                i += 2;
            }
            if i < chars.len() && chars[i] == '്' {
                i += 1;
                if i < chars.len() && matches!(chars[i], '\u{200c}' | '\u{200d}') {
                    i += 1;
                }
            }
            let cluster: String = chars[start..i].iter().collect();
            let body = mapped(&cluster, &mut result.unsupported, true);
            let (left, right) = match chars.get(i) {
                Some('െ') => ("s", ""),
                Some('േ') => ("t", ""),
                Some('ൈ') => ("ss", ""),
                Some('ൊ') => ("s", "m"),
                Some('ോ') => ("t", "m"),
                Some('ൌ' | 'ൗ') => {
                    if chars[i] == 'ൌ' {
                        ("s", "u")
                    } else {
                        ("", "u")
                    }
                }
                _ => ("", ""),
            };
            if !left.is_empty() || !right.is_empty() {
                i += 1;
            }
            result.text.push_str(left);
            result.text.push_str(&body);
            result.text.push_str(right);
        } else {
            // Longest-match decoding also covers independent vowels and old chillus.
            let remaining: String = chars[i..chars.len().min(i + 8)].iter().collect();
            if let Some((key, value)) = rules().iter().find(|(key, _)| remaining.starts_with(key)) {
                result.text.push_str(value);
                i += key.chars().count();
            } else {
                result.text.push_str(&mapped(
                    &chars[i].to_string(),
                    &mut result.unsupported,
                    i > 0 && ('\u{0d00}'..='\u{0d7f}').contains(&chars[i - 1]),
                ));
                i += 1;
            }
        }
        let end = encoded_offset + result.text[output_start..].encode_utf16().count();
        result.spans.push(EncodingSpan {
            unicode_start: positions[input_start].0,
            unicode_end: positions[i - 1].1,
            encoded_start: encoded_offset,
            encoded_end: end,
        });
        encoded_offset = end;
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn independent_examples_and_edge_cases() {
        let corpus: serde_json::Value = serde_json::from_str(include_str!(
            "../../../data/golden-tests/legacy-karthika.json"
        ))
        .unwrap();
        for example in corpus.as_array().unwrap() {
            let input = example["input"].as_str().unwrap();
            assert_eq!(
                encode_legacy(input).text,
                example["output"].as_str().unwrap(),
                "{input}"
            );
        }
    }
    #[test]
    fn unsupported_characters_are_reported_without_loss() {
        let result = encode_legacy("ൠ ൿ ക\u{200d} 😀");
        assert_eq!(result.text, "ൠ ൿ I\u{200d} 😀");
        assert_eq!(result.unsupported, ["ൠ", "ൿ", "\u{200d}"]);
    }
    #[test]
    fn edit_spans_cover_original_decomposed_text_and_surrogate_pairs() {
        let input = "😀 കൊ ക്രോ";
        let result = encode_legacy(input);
        assert_eq!(result.text, "😀 sIm t{Im");
        assert_eq!(
            result.spans.last().unwrap().unicode_end,
            input.encode_utf16().count()
        );
        assert_eq!(
            result.spans.last().unwrap().encoded_end,
            result.text.encode_utf16().count()
        );
        for pair in result.spans.windows(2) {
            assert_eq!(pair[0].unicode_end, pair[1].unicode_start);
            assert_eq!(pair[0].encoded_end, pair[1].encoded_start);
        }
    }
}
