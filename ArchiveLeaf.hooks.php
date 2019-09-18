<?php

/**
 * Hooks for ArchiveLeaf extension
 *
 * @file
 * @ingroup Extensions
 */
class ArchiveLeafHooks {

    public static function onParserFirstCallInit( Parser &$parser ) {
        $parser->setFunctionHook( 'sanitize_leaf_title', [ self::class, 'renderFunctionSanitize' ] );

        $parser->setHook( 'transcription', self::renderTag( 'transcription' ) );
        $parser->setHook( 'transliteration', self::renderTag( 'transliteration', 'Auto-transliteration' ) );
        $parser->setHook( 'translation', self::renderTag( 'translation', [ self::class, 'getTranslationHeading' ] ) );
    }

    public static function onParserBeforeInternalParse( Parser &$parser, &$text, StripState &$stripState ) {
        $text = preg_replace( '/\n{2,}(<(?:transcription|transliteration|translation)[> ])/', "\n$1", $text );
        $text = preg_replace( '/(<\/(?:transcription|transliteration|translation)>)\n{2,}/', "$1\n", $text );
        return true;
    }

    /**
     * @param Parser $parser
     * @param string $value
     *
     * @return mixed
     */
    public static function renderFunctionSanitize( $parser, $value ) {
        global $wgOut, $wgSitename;
        $sanitized = ArchiveLeaf::sanitizeValue($value);
        $wgOut->setHTMLTitle( $sanitized .' - ' . $wgSitename );
        return $sanitized;
    }

    public static function renderTag( $tagName, $headingTitle = NULL ) {
        return function ( $input, array $args, Parser $parser, PPFrame $frame ) use ( $tagName, $headingTitle ) {
            $html = '<div class="' . $tagName . '">';

            if ( isset( $headingTitle ) ) {
                if ( is_callable( $headingTitle ) ) {
                    $headingTitle = $headingTitle( $args );
                }

                $html .= "<div class='heading-small'><strong>$headingTitle</strong></div>";
            }

            $html .= trim( $input ) . '</div>';

            return array( $html, 'markerType' => 'nowiki' );
        };
    }

    public static function getTranslationHeading( $args ) {
        if ( array_key_exists( 'language', $args ) ) {
            $iso639 = json_decode( file_get_contents( 'extensions/ArchiveLeaf/data/iso-639-3.json' ), true );

            if ( array_key_exists( $args['language'], $iso639 ) ) {
                return $iso639[ $args['language'] ] . ' translation';
            }
        }

        return 'Translation';
    }

    public static function onBeforePageDisplay( OutputPage &$out, Skin &$skin ) {
        $out->addModules( 'ext.archiveleaf.common' );
    }

    public static function onShowEditForm( EditPage &$editor, OutputPage &$out ) {

        global $wgArchiveLeafAutoTransliterate;

        if ( !($editor->preview || $editor->diff)
          && preg_match( '/\{\{EntryImage/', $editor->textbox1 )
          && preg_match( '/\bEntryID=(\S+).*?\bTitle=(\S+).*?\bFullSize=([0-9]+)x([0-9]+).*?\bLocalFileName=(\S+)/s', $editor->textbox1, $matches ) ) {

            if ( $wgArchiveLeafAutoTransliterate ) {
                $editor->textbox1 = preg_replace( '/<transliteration>.*?<\/transliteration>/s', '', $editor->textbox1 );
            }

            if ( $editor->section ) {

                $file = wfFindFile( $matches[5] );

                if ( $file && $file->exists() ) {
                    $transcriberData = array(
                        'mode'              =>  'edit',
                        'archiveItem'       =>  array('id' => $matches[1], 'leaf' => $matches[2]),
                        'imageUrl'          =>  $file->getUrl(),
                        'iiifDimensions'    =>  array('width' => $matches[3], 'height' => $matches[4]),
                    );

                    $out->addHTML( '<script>var transcriberData = ' . json_encode($transcriberData) . ';</script>' );
                    $out->addModules( 'ext.archiveleaf.transcriber' );
                }

            }
        }
    }

    public static function onAttemptSave( EditPage $editor ) {

        global $wgArchiveLeafAutoTransliterate;

        if ( $wgArchiveLeafAutoTransliterate ) {

            $editor->textbox1 = preg_replace( '/<transliteration>.*?<\/transliteration>/', '', $editor->textbox1 );

            $editor->textbox1 = preg_replace_callback( '/<transcription>\s*(.*?)\s*<\/transcription>/s', function( $match ) {
                if (strlen( $match[1] ) ) {
                    return $match[0] . '<transliteration>' . ArchiveLeaf::transliterate( 'Balinese-ban_001', $match[1] ) . '</transliteration>';
                } else {
                    return $match[0];
                }

            }, $editor->textbox1 );

        }

    }

    public static function onArticleViewFooter( $article, $patrolFooterShown ) {

        $wikitext = $article->getPage()->getContent()->getNativeData();

        if ( preg_match( '/\bTitle=(\S+).*?\bFullSize=([0-9]+)x([0-9]+)/s', $wikitext, $matches ) ) {

            $title = $matches[1];
            $pages = array();

            for ($i = 0; ; $i++) {
                $file = wfFindFile("${title}_${i}.jpeg");

                if ( $file && $file->exists() ) {
                    array_push( $pages, $file->getUrl() );
                } else {
                    break;
                }
            }


            if ( count ( $pages ) ) {
                $transcriberData = array(
                    'mode'              => 'view',
                    'imageUrls'         => $pages,
                    'archiveItem'       => array('id' => $title, 'leaf' => 0),
                    'iiifDimensions'    => array('width' => $matches[2], 'height' => $matches[3]),
                );

                $out = $article->getContext()->getOutput();
                $out->addHTML('<script>var transcriberData = ' . json_encode($transcriberData) . ';</script>');
                $out->addModules( 'ext.archiveleaf.transcriber' );
            }
        }

    }

}
