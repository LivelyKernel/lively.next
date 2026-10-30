use swc_common::{BytePos, SourceMapper};

/// Lively source ranges use zero-based UTF-16 offsets, like Babel and String.slice.
pub fn source_position(cm: &dyn SourceMapper, position: BytePos) -> usize {
    if position.is_dummy() {
        return 0;
    }
    let file = cm.lookup_char_pos(position).file;
    let offset = position.0.saturating_sub(file.start_pos.0) as usize;
    // SWC caches this analysis; ASCII files need no per-definition source scan.
    let excess: usize = file
        .analyze()
        .multibyte_chars
        .iter()
        .take_while(|character| character.pos < position)
        .map(|character| character.byte_to_char_diff() as usize)
        .sum();
    offset.min(file.src.len()).saturating_sub(excess)
}
