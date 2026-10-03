from abc import ABC, abstractmethod


class BaseStorage(ABC):

    # --- Dogs ---
    @abstractmethod
    def get_dogs(self):
        """Return list of all dogs."""

    @abstractmethod
    def get_dog(self, dog_id):
        """Return single dog by id."""

    @abstractmethod
    def save_dog(self, dog):
        """Create or update a dog. Returns the dog dict with id."""

    @abstractmethod
    def delete_dog(self, dog_id):
        """Delete a dog by id."""

    # --- Weight history ---
    @abstractmethod
    def get_weights(self, dog_id):
        """Return weight history for a dog, sorted by date."""

    @abstractmethod
    def add_weight(self, dog_id, entry):
        """Add a weight entry {date, weight} for a dog."""

    @abstractmethod
    def delete_weight(self, dog_id, date):
        """Delete a weight entry by date."""

    @abstractmethod
    def add_weights_bulk(self, dog_id, entries):
        """Add multiple weight entries at once. Returns count added, or None if dog not found."""

    # --- Freezer stock ---
    @abstractmethod
    def get_stock(self, dog_id):
        """Return freezer stock dict for a dog."""

    @abstractmethod
    def save_stock(self, dog_id, stock):
        """Save freezer stock dict for a dog."""

    # --- Settings ---
    @abstractmethod
    def get_settings(self):
        """Return global settings dict."""

    @abstractmethod
    def save_settings(self, settings):
        """Save global settings dict."""

    # --- Full export/import ---
    @abstractmethod
    def export_all(self):
        """Return complete data as a dict."""

    @abstractmethod
    def import_all(self, data):
        """Replace all data from a dict.

        The payload is validated by the caller. Implementations must leave the
        existing data intact if the replacement fails partway through.
        """
