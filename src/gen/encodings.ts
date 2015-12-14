import {isDimension, isMeasure, cardinality} from 'vega-lite/src/fielddef';
import {isAggregate} from 'vega-lite/src/encoding';
import {keys, duplicate} from '../util';
import {rule as marksRule} from './marks';
import {EncodingOption, DEFAULT_ENCODING_OPTION} from '../consts';
import {ROW, COLUMN, getSupportedRole} from 'vega-lite/src/channel';
import {Type} from 'vega-lite/src/type';


export default function genEncodings(encodings, fieldDefs, stats, opt: EncodingOption = DEFAULT_ENCODING_OPTION) {
  // generate a collection vega-lite's encoding
  var tmpEncoding = {};

  function assignField(i) {
    // If all fields are assigned, save
    if (i === fieldDefs.length) {
      // at the minimal all chart should have x, y, geo, text or arc
      if (rule.encoding(tmpEncoding, stats, opt)) {
        encodings.push(duplicate(tmpEncoding));
      }
      return;
    }

    // Otherwise, assign i-th field
    var fieldDef = fieldDefs[i];
    for (var j in opt.encodingTypeList) {
      var channel = opt.encodingTypeList[j],
        isDim = isDimension(fieldDef);

      const supportedRole = getSupportedRole(channel);

      // TODO: support "multiple" assignment
      if (
        // encoding not used
        !(channel in tmpEncoding) &&
        // channel support the assigned role
        ((isDim && supportedRole.dimension) || (!isDim && supportedRole.measure)) &&
        // the field satisties the channel's rule
        rule.channel[channel](tmpEncoding, fieldDef, stats, opt)
      ) {
        tmpEncoding[channel] = fieldDef;
        assignField(i + 1);
        delete tmpEncoding[channel];
      }
    }
  }

  assignField(0);

  return encodings;
}

namespace rule {
  export namespace channel {
    export const x = noRule;
    export const y = noRule;
    export const text = noRule;
    export const detail = noRule;
    export const size = retinalEncRules;

    // facet rules has interaction with mark -- so they are in marks.ts
    // TODO: revise this after we revise text encoding in Vega-lite
    export const row = noRule;
    export const column = noRule;

    export function color(encoding, fieldDef, stats, opt: EncodingOption) {
      // Don't use color if omitMultipleRetinalEncodings is true and we already have other retinal encoding
      if (!retinalEncRules(encoding, fieldDef, stats, opt)) {
        return false;
      }

      // Color must be either measure or dimension with cardinality lower than the max cardinality
      return isMeasure(fieldDef) ||
        cardinality(fieldDef, stats) <= opt.maxCardinalityForColor;
    }

    export function shape(encoding, fieldDef, stats, opt: EncodingOption) {
      if (!retinalEncRules(encoding, fieldDef, stats, opt)) {
        return false;
      }

      // TODO: revise if this should mainly be on ranking
      if (opt.omitShapeWithBin && fieldDef.bin && fieldDef.type === Type.QUANTITATIVE) {
        return false;
      }
      if (opt.omitShapeWithTimeDimension && fieldDef.timeUnit && fieldDef.type === Type.TEMPORAL) {
        return false;
      }

      return cardinality(fieldDef, stats) <= opt.maxCardinalityForShape;
    }

    function noRule() { return true; }
    function retinalEncRules(encoding, fieldDef, stats, opt: EncodingOption) {
      if (opt.omitMultipleRetinalEncodings) {
        if (encoding.color || encoding.size || encoding.shape) {
          return false;
        }
      }
      return true;
    }
  }

function dotPlotRules(encoding, stats, opt: EncodingOption) {
  if (opt.omitDotPlot) { return false;}

  // Dot plot should always be horizontal
  if (opt.omitTranspose && encoding.y) { return false;}

  // Omit Dot plot with facet
  if (opt.omitDotPlotWithFacet && (encoding.row || encoding.column)) {
    return false;
  }

  // dot plot shouldn't have other encoding
  if (opt.omitDotPlotWithExtraEncoding && keys(encoding).length > 1) {
    return false;
  }

  if (opt.omitDotPlotWithOnlyCount) {
    // one dimension "count"
    if (encoding.x && encoding.x.aggregate === 'count' && !encoding.y) {
      return false;
    }
    if (encoding.y && encoding.y.aggregate === 'count' && !encoding.x) {
      return false;
    }
  }
  return true;
}

function xyPlotRules(encoding, stats, opt: EncodingOption) {
  if (encoding.row || encoding.column) { // have facet(s)
    if (opt.omitNonTextAggrWithAllDimsOnFacets) {
      // remove all aggregated charts with all dims on facets (row, column)
      if (isAggrWithAllDimOnFacets(encoding)) { return false; }
    }
  }

  var isDimX = isDimension(encoding.x),
    isDimY = isDimension(encoding.y);

  // If both x and y are dimension, and the plot is not aggregated,
  // there might be occlusion.
  if (opt.omitRawWithXYBothDimension && isDimX && isDimY && !isAggregate(encoding)) {
    // FIXME actually check if there would be occlusion #90
    return false;
  }

  if (opt.omitTranspose) {
    if (isDimX !== isDimY) { // dim x mea
      // create horizontal histogram for ordinal
      if ((encoding.y.type === Type.NOMINAL || encoding.y.type === Type.ORDINAL) && isMeasure(encoding.x)) {
        return true;
      }

      // vertical histogram for binned Q and T
      if (!isDimY && isDimX && !(encoding.x.type === Type.NOMINAL || encoding.x.type === Type.ORDINAL)) {
        return true;
      }

      return false;
    } else if (encoding.y.type=== Type.TEMPORAL || encoding.x.type === Type.TEMPORAL) {
      // FIXME revise this
      if (encoding.y.type=== Type.TEMPORAL && encoding.x.type !== Type.TEMPORAL) {
        return false;
      }
    } else {
      // FIXME: test if we can remove this rule
      // show only one OxO, QxQ
      if (encoding.x.field > encoding.y.field) {
        return false;
      }
    }
  }
  return true;
}

  /** List of rules that are only considered at the end of the generation process */
  export function encoding(encoding, stats, opt: EncodingOption) {
    // TODO call Vega-Lite validate instead once it is implemented
    // encoding.text is only used for TEXT TABLE
    if (encoding.text) {
      return marksRule.text(encoding, stats, opt);
    }

    const hasX = !!encoding.x, hasY = !!encoding.y;

    if (hasX !== hasY) { // DOT PLOT  (plot with one axis)
      return dotPlotRules(encoding, stats, opt);
    } else if (hasX && hasY) { // CARTESIAN PLOT with X and Y
      return xyPlotRules(encoding, stats, opt);
    }
    // TODO: consider other type of visualization (e.g., geo, arc) when we have them.
    return false;
  }

  export function isAggrWithAllDimOnFacets(encoding) {
    var hasAggr = false, hasOtherO = false;
    for (var channel in encoding) {
      var fieldDef = encoding[channel];
      if (fieldDef.aggregate) {
        hasAggr = true;
      }
      if (isDimension(fieldDef) && (channel !== ROW && channel !== COLUMN)) {
        hasOtherO = true;
      }
      if (hasAggr && hasOtherO) { break; }
    }

    return hasAggr && !hasOtherO;
  };
}
