import { InjectionToken, inject } from '@angular/core';
import { BooksPageActions } from '@book-co/books-page/actions';
import { BookModel } from '@book-co/shared-models';
import { BooksService } from '@book-co/shared-services';
import { adapt } from '@state-adapt/angular';
import { getAction } from '@state-adapt/core';
import { createEntityState } from '@state-adapt/core/adapters';
import { Source, getRequestSources, toSource } from '@state-adapt/rxjs';
import { concatMap, filter, map } from 'rxjs/operators';
import { State, adapter } from './books.adapter';

export const initialState: State = {
  activeBookId: null,
  isLoading: true,
  error: null,
  books: createEntityState(),
};

export const BooksStore = new InjectionToken('BooksStore', {
  providedIn: 'root',
  factory: () => {
    const booksService = inject(BooksService);

    // https://state-adapt.github.io/docs/rxjs#getrequestsources
    const booksRequestSources = getRequestSources(
      'books',
      booksService.fetchAll()
    );

    const bookCreated$ = BooksPageActions.saveBook$.pipe(
      filter(({ payload }) => !('id' in payload)),
      concatMap(({ payload }) => booksService.create(payload)),
      // https://state-adapt.github.io/docs/rxjs#tosource
      toSource('bookCreated$')
    );

    const bookUpdated$ = BooksPageActions.saveBook$.pipe(
      filter(BooksPageActions.isBookModelAction),
      concatMap(
        ({ payload }) =>
          booksService
            .update(payload.id, payload)
            .pipe(map((book) => getAction('bookUpdated$', [book.id, book]))) // https://state-adapt.github.io/docs/core#getaction
      )
    );

    const bookSpecialUpdated$ = <Source<[string, BookModel]>>BooksPageActions.specialUpdate$.pipe(
      concatMap(
        ({ payload }) =>
          booksService
          .updateSpecial(payload)
          .pipe(
            map((book) => getAction('bookUpdated$', [book.id, book])),
          )
      ),
    );

    const bookDeleted$ = BooksPageActions.deleteBook$.pipe(
      concatMap(({ payload }) =>
        booksService
          .delete(payload)
          // https://state-adapt.github.io/docs/core#getaction
          .pipe(map(() => getAction('bookDeleted$', payload)))
      )
    );

    // https://state-adapt.github.io/angular/docs/angular#adapt
    return adapt(['books', initialState, adapter], {
      receiveBooks: booksRequestSources.success$,
      receiveError: booksRequestSources.error$,
      addBook: bookCreated$,
      updateBook: bookUpdated$ as Source<[string, BookModel]>, // https://state-adapt.github.io/docs/rxjs#source
      removeBooksOne: bookDeleted$,
      updateBooksOne: bookSpecialUpdated$
      // updateBooksOne: bookSpecialUpdated$ as Source<[string, BookModel]>
    });
  },
});
